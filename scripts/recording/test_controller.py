import unittest
from pathlib import Path
from unittest.mock import patch
from controller import Controller, Stopped, locate, validate, main, keyboard_shown, empty_input, DEMO_PACKAGE, lock_device


def xml(label='Select E01', box='[20,100][300,160]', enabled='true', count=1):
    return '<hierarchy>'+''.join(f'<node content-desc="{label}" text="" enabled="{enabled}" clickable="true" bounds="{box}"/>' for _ in range(count))+'</hierarchy>'


class ControllerTests(unittest.TestCase):
    def test_historical_native_xml_disabled_button_is_not_its_enabled_text_child(self):
        source=(Path(__file__).parent/'fixtures/historical-mock-zoom.xml').read_text()
        viewport=(0,0,1080,2316)
        self.assertEqual(locate(source,'Original',viewport),(159,246))
        for label in ['Virtual try-on','Zoom in']:
            with self.assertRaises(Stopped): locate(source,label,viewport)

    def test_mock_package_is_fixed_and_production_foreground_is_rejected(self):
        c=Controller('adb','fake',(0,0,400,800),(0,50,400,700),mock=True)
        self.assertEqual(c.package, DEMO_PACKAGE)
        with patch.object(c,'call',return_value='mCurrentFocus=Window{ com.youcam.shoppingconcierge/.MainActivity}') as call:
            with self.assertRaises(Stopped): c.shell('input','tap','1','1')
            self.assertEqual(call.call_count,1)  # Foreground read only; no tap sent.

    def test_keyboard_server_visibility_overrides_retained_client_view(self):
        self.assertFalse(keyboard_shown('mInputShown=false\nmIsInputViewShown=true'))
        self.assertTrue(keyboard_shown('mInputShown=true'))
        with self.assertRaises(Stopped): keyboard_shown('')

    def test_native_placeholder_is_empty_but_real_draft_is_preserved(self):
        import xml.etree.ElementTree as ET
        self.assertTrue(empty_input(ET.fromstring('<node text="Prompt" hint="Prompt"/>')))
        self.assertFalse(empty_input(ET.fromstring('<node text="Private draft" hint="Prompt"/>')))

    def test_full_story_and_mock_preparation_are_bounded_and_never_render(self):
        import json
        root=Path(__file__).parent
        for name, sends in [('full-story.recipe.json',3),('mock-prepare.recipe.json',1)]:
            recipe=json.loads((root/name).read_text())
            validate(recipe)
            self.assertEqual(sum(s.get('target')=='Send to concierge' for s in recipe),sends)
            self.assertFalse(any(s.get('target') in ['Try on','Retry request','Start new'] for s in recipe))

    def test_mock_mode_rejects_combined_record_flag_before_adb(self):
        recipe=str(Path(__file__).parent/'full-story.recipe.json')
        with patch('sys.argv',['controller.py',recipe,'--record','--calibrate-mock']), patch('controller.subprocess.check_output') as call, patch('sys.stderr'):
            with self.assertRaises(SystemExit): main()
            call.assert_not_called()

    def test_revealing_selected_card_does_not_tap_disabled_selection_again(self):
        c=Controller('adb','fake',(0,0,400,800),(0,50,400,700),mock=True)
        with patch.object(c,'snapshot',return_value=xml(enabled='false')), patch.object(c,'shell') as shell:
            c.tap('Select E01','down',reveal=True)
            shell.assert_not_called()

    def test_exact_native_content_boundary_keeps_image_marker_visible(self):
        import xml.etree.ElementTree as ET
        from controller import visible
        image=ET.fromstring('<node bounds="[45,784][1035,2181]"/>')
        self.assertFalse(visible(image,(0,80,1080,2180)))
        self.assertTrue(visible(image,(0,80,1080,2181)))

    def test_chapters_are_exactly_the_full_story_with_three_total_sends(self):
        import json
        root=Path(__file__).parent
        full=json.loads((root/'full-story.recipe.json').read_text())
        parts=[json.loads((root/(name+'.recipe.json')).read_text()) for name in ['01-decisions','02-viewer','03-necklaces-summary']]
        self.assertEqual(sum(parts,[]),full)
        self.assertEqual(sum(s.get('target')=='Send to concierge' for part in parts for s in part),3)

    def test_second_controller_cannot_own_same_device(self):
        import uuid
        serial='test-'+uuid.uuid4().hex
        first=lock_device(serial)
        try:
            with self.assertRaises(Stopped): lock_device(serial)
        finally: first.close()
        second=lock_device(serial)
        second.close()

    def test_unique_visible_control(self):
        self.assertEqual(locate(xml(), 'Select E01', (0, 50, 400, 800)), (160, 130))

    def test_ambiguous_disabled_clipped_and_inverted_stop(self):
        for source in [xml(count=2), xml(enabled='false'), xml(box='[20,10][300,160]'), xml(box='[20,180][300,160]')]:
            with self.assertRaises(Stopped):
                locate(source, 'Select E01', (0, 50, 400, 800))

    def test_paid_render_new_session_retry_and_unknown_steps_forbidden(self):
        for label in ['Try on', 'Resume try-on', 'Start new', 'Start a new session', 'Retry request', 'Compare N01', 'Compare N02']:
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
        with patch.object(c,'snapshot',return_value='<hierarchy/>'), patch.object(c,'shell',return_value='mInputShown=false') as shell, patch('controller.time.sleep'):
            with self.assertRaises(Stopped): c.tap('Reject E05','down')
            self.assertEqual(sum(x.args[1:2]==('swipe',) for x in shell.call_args_list),12)

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
