import unittest
from pathlib import Path
from unittest.mock import patch
from controller import Controller, Stopped, locate, validate, main


def xml(label='Select E01', box='[20,100][300,160]', enabled='true', count=1):
    return '<hierarchy>'+''.join(f'<node content-desc="{label}" text="" enabled="{enabled}" clickable="true" bounds="{box}"/>' for _ in range(count))+'</hierarchy>'


class ControllerTests(unittest.TestCase):
    def test_historical_native_xml_disabled_button_is_not_its_enabled_text_child(self):
        source=(Path(__file__).parent/'fixtures/historical-mock-zoom.xml').read_text()
        viewport=(0,0,1080,2316)
        self.assertEqual(locate(source,'Original',viewport),(159,246))
        for label in ['Virtual try-on','Zoom in']:
            with self.assertRaises(Stopped): locate(source,label,viewport)

    def test_unique_visible_control(self):
        self.assertEqual(locate(xml(), 'Select E01', (0, 50, 400, 800)), (160, 130))

    def test_ambiguous_disabled_clipped_and_inverted_stop(self):
        for source in [xml(count=2), xml(enabled='false'), xml(box='[20,10][300,160]'), xml(box='[20,180][300,160]')]:
            with self.assertRaises(Stopped):
                locate(source, 'Select E01', (0, 50, 400, 800))

    def test_paid_render_new_session_retry_and_unknown_steps_forbidden(self):
        for label in ['Try on', 'Resume try-on', 'Start new', 'Start a new session', 'Retry request']:
            with self.assertRaises(Stopped):
                validate([dict(action='tap', target=label, before='a', after='b')])
        with self.assertRaises(Stopped):
            validate([dict(action='shell', target='anything', before='a', after='b')])

    def test_planning_attempt_bound(self):
        step=dict(action='tap',target='Send to concierge',before='a',after='b')
        with self.assertRaises(Stopped): validate([step]*4)

    def test_tap_once_even_if_postcondition_fails(self):
        c=Controller('adb','fake',(0,0,400,800),(0,50,400,700))
        with patch.object(c,'snapshot',return_value=xml()), patch.object(c,'shell') as shell:
            c.tap('Select E01')
            shell.assert_called_once_with('input','tap','160','130')

    def test_bounded_scroll_missing_target(self):
        c=Controller('adb','fake',(0,0,400,800),(0,50,400,700))
        with patch.object(c,'snapshot',return_value='<hierarchy/>'), patch.object(c,'shell',return_value='') as shell, patch('controller.time.sleep'):
            with self.assertRaises(Stopped): c.tap('Reject E05','down')
            self.assertEqual(sum(x.args[1:2]==('swipe',) for x in shell.call_args_list),6)

    def test_keyboard_blocks_scrolling(self):
        c=Controller('adb','fake',(0,0,400,800),(0,50,400,700))
        with patch.object(c,'snapshot',return_value='<hierarchy/>'), patch.object(c,'shell',return_value='mInputShown=true') as shell:
            with self.assertRaises(Stopped): c.tap('Reject E05','down')
            shell.assert_called_once_with('dumpsys','input_method')

    def test_wrong_foreground_stops_before_ui_dump(self):
        c=Controller('adb','fake',(0,0,400,800),(0,50,400,700))
        with patch.object(c,'shell',return_value='mCurrentFocus=system/gallery') as shell:
            with self.assertRaises(Stopped): c.snapshot()
            self.assertEqual(shell.call_count,1)

    def test_no_send_without_verified_draft(self):
        c=Controller('adb','fake',(0,0,400,800),(0,50,400,700))
        with patch.object(c,'wait'),patch.object(c,'snapshot',return_value=xml('Shopping message')),patch.object(c,'tap') as tap:
            with self.assertRaises(Stopped):
                c.run([dict(action='tap',target='Send to concierge',before='a',after='b')])
            tap.assert_not_called()

    def test_cli_default_never_invokes_adb(self):
        recipe=str(Path(__file__).parent/'viewer-recipe.example.json')
        with patch('sys.argv',['controller.py',recipe]), patch('controller.subprocess.check_output') as call, patch('controller.subprocess.run') as run:
            main()
            call.assert_not_called()
            run.assert_not_called()

    def test_recording_requires_all_authorization_gates_before_adb(self):
        recipe=str(Path(__file__).parent/'viewer-recipe.example.json')
        with patch('sys.argv',['controller.py',recipe,'--record']), patch('controller.subprocess.check_output') as call, patch('sys.stderr'):
            with self.assertRaises(SystemExit): main()
            call.assert_not_called()

    def test_no_device_access_for_offline_recipe_validation(self):
        validate([dict(action='tap',target='Original',before='Virtual try-on',after='Original photo')])


if __name__=='__main__': unittest.main()
