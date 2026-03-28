import { describe, it, expect } from 'vitest';
import { WIX_TYPE_MAP, mapWixType } from '../types/index.js';

describe('WIX_TYPE_MAP', () => {
  it('maps known Wix internal types', () => {
    expect(WIX_TYPE_MAP['wysiwyg.viewer.components.WRichText']).toBe('Text');
    expect(WIX_TYPE_MAP['wysiwyg.viewer.components.SiteButton']).toBe('Button');
    expect(WIX_TYPE_MAP['wysiwyg.viewer.components.WPhoto']).toBe('Image');
    expect(WIX_TYPE_MAP['wysiwyg.viewer.components.Repeater']).toBe('Repeater');
    expect(WIX_TYPE_MAP['wysiwyg.viewer.components.inputs.TextInput']).toBe('Input');
    expect(WIX_TYPE_MAP['wysiwyg.viewer.components.inputs.TextArea']).toBe('TextBox');
    expect(WIX_TYPE_MAP['wysiwyg.viewer.components.inputs.ComboBoxInput']).toBe('Dropdown');
    expect(WIX_TYPE_MAP['wysiwyg.viewer.components.StripColumnsContainer']).toBe('Section');
    expect(WIX_TYPE_MAP['wysiwyg.viewer.components.Column']).toBe('Box');
    expect(WIX_TYPE_MAP['wysiwyg.viewer.components.MediaBox']).toBe('Box');
    expect(WIX_TYPE_MAP['tpa.viewer.components.TPASection']).toBe('Dataset');
  });

  it('covers all 17 WixElementType values', () => {
    const types = new Set(Object.values(WIX_TYPE_MAP));
    const required = [
      'Section', 'Box', 'Text', 'Button', 'Image', 'Repeater',
      'Input', 'TextBox', 'Dropdown', 'Toggle', 'ProgressBar',
      'HtmlComponent', 'Video', 'Dataset', 'Gallery', 'DatePicker',
      'CheckboxGroup', 'RadioButton',
    ];
    for (const t of required) {
      expect(types.has(t as never), `WixElementType '${t}' not covered`).toBe(true);
    }
  });
});

describe('mapWixType', () => {
  it('returns mapped type for known internal type', () => {
    expect(mapWixType('wysiwyg.viewer.components.WRichText')).toBe('Text');
  });

  it('returns null for unknown type', () => {
    expect(mapWixType('some.unknown.component.Type')).toBeNull();
  });
});
