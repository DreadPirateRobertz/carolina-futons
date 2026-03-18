/**
 * typeMapping.test.ts — S3: Wix internal type → WixElementType mapping tests.
 */
import { describe, it, expect } from 'vitest';
import { mapWixType, WIX_TYPE_MAP } from '../src/types/index.js';

describe('mapWixType', () => {
  it('maps WRichText to Text', () => {
    expect(mapWixType('wysiwyg.viewer.components.WRichText')).toBe('Text');
  });

  it('maps SiteButton to Button', () => {
    expect(mapWixType('wysiwyg.viewer.components.SiteButton')).toBe('Button');
  });

  it('maps WPhoto to Image', () => {
    expect(mapWixType('wysiwyg.viewer.components.WPhoto')).toBe('Image');
  });

  it('maps Repeater to Repeater', () => {
    expect(mapWixType('wysiwyg.viewer.components.Repeater')).toBe('Repeater');
  });

  it('maps TextInput to Input', () => {
    expect(mapWixType('wysiwyg.viewer.components.inputs.TextInput')).toBe('Input');
  });

  it('maps TextArea to TextBox', () => {
    expect(mapWixType('wysiwyg.viewer.components.inputs.TextArea')).toBe('TextBox');
  });

  it('maps ComboBoxInput to Dropdown', () => {
    expect(mapWixType('wysiwyg.viewer.components.inputs.ComboBoxInput')).toBe('Dropdown');
  });

  it('maps StripColumnsContainer to Section', () => {
    expect(mapWixType('wysiwyg.viewer.components.StripColumnsContainer')).toBe('Section');
  });

  it('maps Column to Box', () => {
    expect(mapWixType('wysiwyg.viewer.components.Column')).toBe('Box');
  });

  it('maps MediaBox to Box', () => {
    expect(mapWixType('wysiwyg.viewer.components.MediaBox')).toBe('Box');
  });

  it('maps TPASection to Dataset', () => {
    expect(mapWixType('tpa.viewer.components.TPASection')).toBe('Dataset');
  });

  it('maps Video to Video', () => {
    expect(mapWixType('wysiwyg.viewer.components.Video')).toBe('Video');
  });

  it('maps VideoPlayer to Video', () => {
    expect(mapWixType('wysiwyg.viewer.components.VideoPlayer')).toBe('Video');
  });

  it('maps Grid to Repeater', () => {
    expect(mapWixType('wysiwyg.viewer.components.Grid')).toBe('Repeater');
  });

  it('maps ToggleSwitch to Toggle', () => {
    expect(mapWixType('wysiwyg.viewer.components.ToggleSwitch')).toBe('Toggle');
  });

  it('maps SlideShowGallery to Gallery', () => {
    expect(mapWixType('wysiwyg.viewer.components.SlideShowGallery')).toBe('Gallery');
  });

  it('maps MatrixGallery to Gallery', () => {
    expect(mapWixType('wysiwyg.viewer.components.MatrixGallery')).toBe('Gallery');
  });

  it('maps DatePicker to DatePicker', () => {
    expect(mapWixType('wysiwyg.viewer.components.inputs.DatePicker')).toBe('DatePicker');
  });

  it('maps CheckboxGroup to CheckboxGroup', () => {
    expect(mapWixType('wysiwyg.viewer.components.inputs.CheckboxGroup')).toBe('CheckboxGroup');
  });

  it('maps RadioGroup to RadioButton', () => {
    expect(mapWixType('wysiwyg.viewer.components.inputs.RadioGroup')).toBe('RadioButton');
  });

  it('maps ProgressBar to ProgressBar', () => {
    expect(mapWixType('wysiwyg.viewer.components.ProgressBar')).toBe('ProgressBar');
  });

  it('returns null for unknown type', () => {
    expect(mapWixType('wysiwyg.viewer.components.Unknown')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(mapWixType('')).toBeNull();
  });

  it('WIX_TYPE_MAP covers all 22 known mappings', () => {
    expect(Object.keys(WIX_TYPE_MAP).length).toBe(22);
  });
});
