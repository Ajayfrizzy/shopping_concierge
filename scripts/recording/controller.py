"""Bounded ADB controller. No device actions on import; record requires explicit gates.

Recipe steps: {action: tap|type|back|wait, target: exact label, before: visible
screen marker, after: visible postcondition, scroll: optional bool}. No arbitrary
shell commands or render controls are accepted. XML is kept in memory.
"""
import argparse
import json
import re
import shlex
import subprocess
import time
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = 'com.youcam.shoppingconcierge'
ALLOWED = {
    'Shopping message', 'Send to concierge', 'Reject E05', 'Too flashy',
    'Reject product', 'Select E01', 'Show virtual try-on products',
    'Show all matching products', 'Try on E01', 'Expand and compare photos',
    'Original', 'Virtual try-on', 'Zoom in', 'Fit image', 'Back to try-on',
    'Back to shopping', 'Session summary', 'Show more matches',
}
MESSAGES = {'Silver earrings under $120',
            'Now find a necklace that works with this under $100', 'Compare N01 and N02'}


class Stopped(RuntimeError):
    pass


def nodes(xml):
    return list(ET.fromstring(xml).iter('node'))


def matches(n, label):
    return label in (n.get('text'), n.get('content-desc'))


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
            if s.get('target') not in ALLOWED:
                raise Stopped('Tap is not allowed (render/session/retry controls are excluded)')
            sends += s['target'] == 'Send to concierge'
        elif s.get('action') == 'type':
            if s.get('target') not in MESSAGES:
                raise Stopped('Unreviewed message')
        elif s.get('action') not in ['back', 'wait']:
            raise Stopped('Unknown action')
    if sends > 3:
        raise Stopped('At most three planning sends per take')


class Controller:
    def __init__(self, adb, serial, viewport, card_viewport):
        self.adb, self.serial = adb, serial
        self.viewport, self.cards = viewport, card_viewport
        self.deadline = time.monotonic() + 170
        self.sends = 0
        self.verified_draft = None

    def call(self, *args):
        if time.monotonic() >= self.deadline:
            raise Stopped('170-second take deadline reached')
        return subprocess.check_output([self.adb, '-s', self.serial, *args],
                                       text=True, timeout=12)

    def shell(self, *args):
        # adb shell has a second shell parsing layer; quote every argument.
        return self.call('shell', shlex.join(args))

    def snapshot(self):
        window = self.shell('dumpsys', 'window', 'windows')
        focus = '\n'.join(x for x in window.splitlines() if 'mCurrentFocus=' in x)
        if not re.search(r'\b' + re.escape(PACKAGE) + r'/', focus):
            raise Stopped('Production app is not foreground; do not navigate through system UI')
        raw = self.shell('uiautomator', 'dump', '/dev/tty')
        start, end = raw.find('<?xml'), raw.rfind('</hierarchy>')
        if start < 0 or end < 0:
            raise Stopped('UI hierarchy unavailable')
        xml = raw[start:end + len('</hierarchy>')]
        text = ' '.join(n.get('text', '') for n in nodes(xml)).lower()
        if any(s in text for s in ['has expired', 'could not be loaded', 'retry request',
                                  'unable to', 'request timed out']):
            raise Stopped('Error, expiry or recovery screen; stop without retry')
        return xml

    def marker(self, xml, label):
        return any(matches(n, label) and visible(n, self.viewport) for n in nodes(xml))

    def wait(self, label):
        until = min(self.deadline, time.monotonic() + 45)
        while time.monotonic() < until:
            xml = self.snapshot()
            if self.marker(xml, label):
                return xml
            time.sleep(0.4)
        raise Stopped(f'Postcondition timeout: {label}; no retry was sent')

    def tap(self, label, scroll=False):
        if label not in ALLOWED:
            raise Stopped('Forbidden tap')
        for attempt in range(7):
            xml = self.snapshot()
            viewport = self.cards if scroll else self.viewport
            try:
                x, y = locate(xml, label, viewport)
            except Stopped:
                # Ambiguous actionable controls must abort, not scroll away.
                found = [n for n in nodes(xml) if matches(n, label) and visible(n, viewport)
                         and n.get('enabled') == 'true' and n.get('clickable') == 'true']
                if len(found) > 1 or not scroll or attempt == 6:
                    raise
                # Refuse swipes with keyboard open; never use Back blindly to hide it.
                ime = self.shell('dumpsys', 'input_method')
                if re.search(r'mInputShown=true|mIsInputViewShown=true', ime):
                    raise Stopped('Close keyboard before scrolling')
                try:
                    more = locate(xml, 'Show more matches', self.cards) if scroll == 'down' else None
                except Stopped:
                    more = None
                if more:
                    self.shell('input', 'tap', *map(str, more))
                else:
                    l, t, r, b = self.cards
                    start, end = (b-30, t+30) if scroll == 'down' else (t+30, b-30)
                    self.shell('input', 'swipe', str((l+r)//2), str(start),
                               str((l+r)//2), str(end), '400')
                time.sleep(0.3)
                continue
            self.shell('input', 'tap', str(x), str(y))
            return  # Never repeat a successful tap while waiting for response.

    def run(self, recipe):
        validate(recipe)
        for step in recipe:
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
                if len(fields) != 1 or fields[0].get('text', ''):
                    raise Stopped('Composer must be empty; existing drafts are preserved')
                self.tap('Shopping message')
                self.shell('input', 'text', target.replace(' ', '%s'))
                xml = self.snapshot()
                if not any(matches(n, 'Shopping message') and n.get('text') == target for n in nodes(xml)):
                    raise Stopped('Typed draft differs; do not send')
                self.verified_draft = target
            elif action == 'back':
                self.shell('input', 'keyevent', '4')
            self.wait(step['after'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('recipe', type=Path)
    parser.add_argument('--record', action='store_true')
    parser.add_argument('--authorize-production-decisions', action='store_true')
    parser.add_argument('--prepared-result-reviewed', action='store_true')
    parser.add_argument('--serial')
    parser.add_argument('--adb', default=str(Path.home() / 'Library/Android/sdk/platform-tools/adb'))
    parser.add_argument('--viewport', nargs=4, type=int)
    parser.add_argument('--cards', nargs=4, type=int)
    args = parser.parse_args()
    recipe = json.loads(args.recipe.read_text())
    validate(recipe)
    if not args.record:
        print(f'Validated {len(recipe)} steps offline. No ADB, recording or provider operation.')
        return
    if not (args.authorize_production_decisions and args.prepared_result_reviewed
            and args.serial and args.viewport and args.cards):
        parser.error('Recording requires explicit decision authorization, reviewed prepared result, serial and measured viewports')
    l, t, r, b = args.viewport
    cl, ct, cr, cb = args.cards
    if not (0 <= l <= cl < cr <= r and 0 <= t <= ct < cb <= b and cb-ct > 100):
        parser.error('Invalid viewport geometry')
    devices = subprocess.check_output([args.adb, 'devices'], text=True, timeout=12)
    if not re.search(r'^' + re.escape(args.serial) + r'\s+device$', devices, re.M):
        raise Stopped('Selected device is not authorized/connected')
    c = Controller(args.adb, args.serial, args.viewport, args.cards)
    c.snapshot()
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
