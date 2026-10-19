"""Bounded ADB controller. No device actions on import; record requires explicit gates.

Recipe steps: {action: tap|type|back|wait, target: exact label, before: visible
screen marker, after: visible postcondition, scroll: optional bool}. No arbitrary
shell commands or render controls are accepted. XML is kept in memory.
"""
import argparse
import fcntl
import hashlib
import tempfile
import json
import re
import shlex
import subprocess
import time
import uuid
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = 'com.youcam.shoppingconcierge'
DEMO_PACKAGE = PACKAGE + '.demo'
ALLOWED = {
    'Shopping message', 'Send to concierge', 'Reject E05', 'Too flashy',
    'Reject product', 'Select E01', 'Show virtual try-on products',
    'Show all matching products', 'Try on E01', 'Expand and compare photos',
    'Original', 'Virtual try-on', 'Zoom in', 'Fit image', 'Back to try-on',
    'Back to shopping', 'Back to conversation', 'Session summary', 'Show more matches', 'Compare N01', 'Compare N02',
}
REVEAL_ONLY = {'What changed', 'Compare against your criteria', 'Quiet Round Necklaces · N01', 'Petal Necklaces · N02', 'Your preferences', 'Quiet Round Earrings · USD 35.00', 'Gala Earrings · USD 110.00', 'Chosen E01 · Earrings'}
MESSAGES = {'Silver earrings under $120',
            'Now find a necklace that works with this under $100', 'Compare N01 and N02'}


class Stopped(RuntimeError):
    pass


def nodes(xml):
    return list(ET.fromstring(xml).iter('node'))


def matches(n, label):
    return label in (n.get('text'), n.get('content-desc'))


def keyboard_shown(report):
    # InputMethodManagerService is authoritative; IME client's view can remain allocated.
    current = re.findall(r'\bmInputShown=(true|false)', report)
    if len(current) == 1:
        return current[0] == 'true'
    if len(current) > 1:
        raise Stopped('Ambiguous keyboard visibility')
    fallback = re.findall(r'\bmIsInputViewShown=(true|false)', report)
    if len(fallback) == 1:
        return fallback[0] == 'true'
    raise Stopped('Unknown keyboard visibility')


def empty_input(n):
    return not n.get('text', '') or (bool(n.get('hint')) and n.get('text') == n.get('hint'))


def bounds(n):
    m = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', n.get('bounds', ''))
    if not m:
        raise Stopped('Invalid UI bounds')
    return tuple(map(int, m.groups()))


def visible(n, viewport):
    try:
        x, y, r, b = bounds(n)
    except Stopped:
        return False
    l, t, right, bottom = viewport
    # Require the complete control inside the safe viewport; never tap clipped nodes.
    return l <= x < r <= right and t <= y < b <= bottom


def locate(xml, label, viewport, enabled=True):
    found = [n for n in nodes(xml) if matches(n, label) and visible(n, viewport)
             and (not enabled or n.get('enabled') == 'true')]
    # Text children may duplicate their clickable parent; choose actionable nodes.
    if enabled:
        found = [n for n in found if n.get('clickable') == 'true'
                 or n.get('class') == 'android.widget.EditText']
    if len(found) != 1:
        raise Stopped(f'Expected one visible control: {label}; found {len(found)}')
    x, y, r, b = bounds(found[0])
    return ((x + r) // 2, (y + b) // 2)


def validate(recipe):
    if not isinstance(recipe, list) or not 1 <= len(recipe) <= 60:
        raise Stopped('Recipe must contain 1–60 steps')
    sends = 0
    for s in recipe:
        if not isinstance(s, dict) or set(s) - {'action', 'target', 'before', 'after', 'scroll'}:
            raise Stopped('Unknown recipe fields')
        if not all(isinstance(s.get(k), str) and s[k] for k in ['before', 'after']):
            raise Stopped('Each step requires screen and postcondition markers')
        if s.get('scroll', False) not in (False, 'up', 'down'):
            raise Stopped('Scroll must be up or down')
        if s.get('action') == 'tap':
            if s.get('target') not in ALLOWED - {'Compare N01', 'Compare N02'}:
                raise Stopped('Tap is not allowed (render/session/retry controls are excluded)')
            sends += s['target'] == 'Send to concierge'
        elif s.get('action') == 'type':
            if s.get('target') not in MESSAGES:
                raise Stopped('Unreviewed message')
        elif s.get('action') == 'reveal':
            if s.get('target') not in ALLOWED | REVEAL_ONLY:
                raise Stopped('Unreviewed reveal target')
        elif s.get('action') not in ['back', 'wait', 'hide_keyboard']:
            raise Stopped('Unknown action')
    if sends > 3:
        raise Stopped('At most three planning sends per take')


class Controller:
    def __init__(self, adb, serial, viewport, card_viewport, *, mock=False):
        self.adb, self.serial = adb, serial
        self.viewport, self.cards = viewport, card_viewport
        self.package = DEMO_PACKAGE if mock else PACKAGE
        self.mock = mock
        self.events = []
        self.cached = None
        self.cache_time = 0
        self.deadline = time.monotonic() + (600 if mock else 170)
        self.started = time.monotonic()
        self.sends = 0
        self.verified_draft = None

    def call(self, *args):
        if time.monotonic() >= self.deadline:
            raise Stopped('170-second take deadline reached')
        return subprocess.check_output([self.adb, '-s', self.serial, *args],
                                       text=True, timeout=12)

    def shell(self, *args):
        # adb shell has a second shell parsing layer; quote every argument.
        if args and args[0] == 'input':
            self.foreground()
            self.cached = None
            self.events.append({'input': list(args[1:]), 'elapsed': round(time.monotonic() - self.started, 3)})
        return self.call('shell', shlex.join(args))

    def foreground(self):
        window = self.shell('dumpsys', 'window')
        focus = '\n'.join(x for x in window.splitlines() if 'mCurrentFocus=' in x)
        if not re.search(r'\b' + re.escape(self.package) + r'/', focus):
            raise Stopped('Expected app is not foreground; no input allowed')

    def snapshot(self):
        self.foreground()
        if self.cached and time.monotonic() - self.cache_time < 0.5:
            return self.cached
        path = '/data/local/tmp/concierge-ui-' + uuid.uuid4().hex + '.xml'
        try:
            self.shell('uiautomator', 'dump', path)
            raw = self.shell('cat', path)
        finally:
            self.shell('rm', '-f', path)
        start, end = raw.find('<?xml'), raw.rfind('</hierarchy>')
        if start < 0 or end < 0:
            raise Stopped('UI hierarchy unavailable')
        xml = raw[start:end + len('</hierarchy>')]
        text = ' '.join(n.get('text', '') for n in nodes(xml)).lower()
        if any(s in text for s in ['has expired', 'could not be loaded', 'retry request',
                                  'unable to', 'request timed out']):
            raise Stopped('Error, expiry or recovery screen; stop without retry')
        self.cached, self.cache_time = xml, time.monotonic()
        return xml

    def marker(self, xml, label):
        if label == '@shopping-ready':
            fields = [n for n in nodes(xml) if matches(n, 'Shopping message')]
            return len(fields) == 1 and fields[0].get('enabled') == 'true' and empty_input(fields[0])
        return any(matches(n, label) and visible(n, self.viewport) for n in nodes(xml))

    def wait(self, label):
        until = min(self.deadline, time.monotonic() + 45)
        while time.monotonic() < until:
            xml = self.snapshot()
            if self.marker(xml, label):
                return xml
            time.sleep(0.4)
        raise Stopped(f'Postcondition timeout: {label}; no retry was sent')

    def tap(self, label, scroll=False, reveal=False):
        if (label not in ALLOWED and not (reveal and label in REVEAL_ONLY)) or (label in {'Compare N01', 'Compare N02'} and not reveal):
            raise Stopped('Forbidden tap')
        for attempt in range(13):
            xml = self.snapshot()
            viewport = self.cards if scroll else self.viewport
            try:
                revealed = [n for n in nodes(xml) if matches(n, label) and visible(n, viewport)]
                if reveal and revealed:
                    self.events.append({'selector': label, 'bounds': list(bounds(revealed[0])), 'action': 'reveal'})
                    return
                x, y = locate(xml, label, viewport)
            except Stopped:
                # Ambiguous actionable controls must abort, not scroll away.
                found = [n for n in nodes(xml) if matches(n, label) and visible(n, viewport)
                         and n.get('enabled') == 'true' and n.get('clickable') == 'true']
                if len(found) > 1 or not scroll or attempt == 12:
                    raise
                # Refuse swipes with keyboard open; never use Back blindly to hide it.
                ime = self.shell('dumpsys', 'input_method')
                if keyboard_shown(ime):
                    raise Stopped('Close keyboard before scrolling')
                try:
                    more = locate(xml, 'Show more matches', self.cards) if scroll == 'down' else None
                except Stopped:
                    more = None
                if more:
                    self.shell('input', 'tap', *map(str, more))
                else:
                    l, t, r, b = self.cards
                    direction, distance = scroll, min(650, b-t-100)
                    targets = [n for n in nodes(xml) if matches(n, label)]
                    if len(targets) == 1:
                        try:
                            _, y, _, bottom = bounds(targets[0])
                            if bottom <= t:
                                direction = 'up'
                            elif y >= b:
                                direction = 'down'
                                distance = max(160, min(distance, y-(b-220)))
                        except Stopped:
                            pass
                    start = b-50 if direction == 'down' else t+50
                    end = start-distance if direction == 'down' else start+distance
                    self.shell('input', 'swipe', str((l+r)//2), str(start),
                               str((l+r)//2), str(end), '600')
                time.sleep(0.3)
                continue
            target_nodes = [n for n in nodes(xml) if matches(n, label) and visible(n, viewport)
                            and n.get('enabled') == 'true' and (n.get('clickable') == 'true' or n.get('class') == 'android.widget.EditText')]
            self.events.append({'selector': label, 'bounds': list(bounds(target_nodes[0])), 'action': 'tap'})
            self.shell('input', 'tap', str(x), str(y))
            return  # Never repeat a successful tap while waiting for response.

    def run(self, recipe):
        validate(recipe)
        for step in recipe:
            step_start = time.monotonic()
            self.wait(step['before'])
            action, target = step['action'], step.get('target')
            if action == 'tap':
                if target == 'Send to concierge':
                    xml = self.snapshot()
                    drafts = [n for n in nodes(xml) if matches(n, 'Shopping message')]
                    if (self.verified_draft is None or len(drafts) != 1
                            or drafts[0].get('text') != self.verified_draft):
                        raise Stopped('Send requires the exact draft typed by this controller')
                    self.verified_draft = None
                    if self.sends >= 3:
                        raise Stopped('Planning attempt limit')
                    self.sends += 1
                self.tap(target, step.get('scroll', False))
            elif action == 'type':
                xml = self.snapshot()
                fields = [n for n in nodes(xml) if matches(n, 'Shopping message')]
                if len(fields) != 1 or not empty_input(fields[0]):
                    raise Stopped('Composer must be empty; existing drafts are preserved')
                self.tap('Shopping message')
                self.shell('input', 'text', target.replace(' ', '%s'))
                xml = self.snapshot()
                if not any(matches(n, 'Shopping message') and n.get('text') == target for n in nodes(xml)):
                    raise Stopped('Typed draft differs; do not send')
                self.verified_draft = target
            elif action == 'reveal':
                self.tap(target, step.get('scroll', 'down'), reveal=True)
            elif action == 'hide_keyboard':
                ime = self.shell('dumpsys', 'input_method')
                if keyboard_shown(ime):
                    self.shell('input', 'keyevent', '4')
            elif action == 'back':
                self.shell('input', 'keyevent', '4')
            self.wait(step['after'])
            self.events.append({'step': step, 'seconds': round(time.monotonic() - step_start, 3)})
            print('Completed:', action, target or '', 'elapsed:', round(time.monotonic()-self.started, 2), flush=True)


def lock_device(serial):
    # Keep the returned descriptor alive for the entire invocation; kernel releases on exit.
    name = 'concierge-controller-' + hashlib.sha256(serial.encode()).hexdigest()[:24] + '.lock'
    handle = (Path(tempfile.gettempdir()) / name).open('a')
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        handle.close()
        raise Stopped('Another controller owns this device; do not run concurrent UI dumps/inputs')
    return handle


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('recipe', type=Path)
    parser.add_argument('--record', action='store_true')
    parser.add_argument('--calibrate-mock', action='store_true')
    parser.add_argument('--authorize-production-decisions', action='store_true')
    parser.add_argument('--prepared-result-reviewed', action='store_true')
    parser.add_argument('--serial')
    parser.add_argument('--adb', default=str(Path.home() / 'Library/Android/sdk/platform-tools/adb'))
    parser.add_argument('--viewport', nargs=4, type=int)
    parser.add_argument('--cards', nargs=4, type=int)
    args = parser.parse_args()
    recipe = json.loads(args.recipe.read_text())
    validate(recipe)
    if args.calibrate_mock and (args.record or args.authorize_production_decisions or args.prepared_result_reviewed):
        parser.error('Mock calibration cannot enable production recording')
    if not args.record and not args.calibrate_mock:
        print(f'Validated {len(recipe)} steps offline. No ADB, recording or provider operation.')
        return
    if not (args.serial and args.viewport and args.cards) or (not args.calibrate_mock and not (args.authorize_production_decisions and args.prepared_result_reviewed)):
        parser.error('Recording requires explicit decision authorization, reviewed prepared result, serial and measured viewports')
    l, t, r, b = args.viewport
    cl, ct, cr, cb = args.cards
    if not (0 <= l <= cl < cr <= r and 0 <= t <= ct < cb <= b and cb-ct > 100):
        parser.error('Invalid viewport geometry')
    device_lock = lock_device(args.serial)
    assert not device_lock.closed
    devices = subprocess.check_output([args.adb, 'devices'], text=True, timeout=12)
    if not re.search(r'^' + re.escape(args.serial) + r'\s+device$', devices, re.M):
        raise Stopped('Selected device is not authorized/connected')
    if args.calibrate_mock:
        with urllib.request.urlopen('http://127.0.0.1:4000/calibration/status', timeout=5) as response:
            status = json.load(response)
        if status.get('calibration') != 'isolated-native-mock-v1' or status.get('actualProviderRequests') != 0:
            raise Stopped('Local mock fixture identity mismatch')
        reverse = subprocess.check_output([args.adb, '-s', args.serial, 'reverse', '--list'], text=True, timeout=12)
        for port in (4000, 8082):
            if f'tcp:{port} tcp:{port}' not in reverse:
                raise Stopped('Missing local-only mock forwarding')
    c = Controller(args.adb, args.serial, args.viewport, args.cards, mock=args.calibrate_mock)
    c.snapshot()
    if args.calibrate_mock:
        completed = False
        try:
            c.run(recipe)
            completed = True
        finally:
            result = {'mode': 'native mock; no recording', 'completed': completed, 'seconds': round(time.monotonic()-c.started, 3), 'events': c.events}
            output = Path('artifacts/demo-calibration') / ('run-' + uuid.uuid4().hex + '.json')
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(result, indent=2))
            print('Calibration trace:', output, 'seconds:', result['seconds'])
        return
    package = c.shell('dumpsys', 'package', PACKAGE)
    if not re.search(r'\bversionCode=6\b', package):
        raise Stopped('Expected installed code 6; verify certificate/hash separately before recording')
    # Unique path, exact PID, fixed command: never stop other recordings or overwrite a take.
    name = 'concierge-' + uuid.uuid4().hex + '.mp4'
    remote = '/sdcard/Download/' + name
    output = Path('artifacts/final-demo') / name
    output.parent.mkdir(parents=True, exist_ok=True)
    pid = c.shell('sh', '-c', f'screenrecord --bit-rate 8000000 --time-limit 170 {remote} >/dev/null 2>&1 & echo $!').strip()
    if not re.fullmatch(r'[1-9][0-9]*', pid):
        raise Stopped('Could not identify recorder PID')
    try:
        c.run(recipe)
    finally:
        # Cleanup must work even after the controller deadline expires.
        subprocess.run([args.adb, '-s', args.serial, 'shell', f'kill -2 {pid}'], timeout=12, check=False)
        for _ in range(20):
            result = subprocess.run([args.adb, '-s', args.serial, 'shell', f'kill -0 {pid}'],
                                    capture_output=True, timeout=5)
            if result.returncode:
                break
            time.sleep(0.25)
        else:
            raise Stopped('Recorder did not exit; preserve remote file and inspect before pulling')
        subprocess.run([args.adb, '-s', args.serial, 'pull', remote, str(output)], check=True, timeout=30)
        print('Private, unreviewed footage saved:', output)


if __name__ == '__main__':
    main()
