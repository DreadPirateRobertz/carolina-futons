/**
 * Core TypeScript interfaces and type mappings for CF Hookup Assistant.
 * S2: TypeScript interfaces for PAGES data.
 * S3: Wix internal type → WixElementType mapping.
 */

export type WixElementType =
  | 'Section'
  | 'Box'
  | 'Text'
  | 'Button'
  | 'Image'
  | 'Repeater'
  | 'Input'
  | 'TextBox'
  | 'Dropdown'
  | 'Toggle'
  | 'ProgressBar'
  | 'HtmlComponent'
  | 'Video'
  | 'Dataset'
  | 'Gallery'
  | 'DatePicker'
  | 'CheckboxGroup'
  | 'RadioButton';

export interface ElementDef {
  id: string;
  type: WixElementType;
  notes: string;
  defaultHidden?: boolean;
  defaultCollapsed?: boolean;
  cssOnly?: boolean;
}

export interface SectionDef {
  name: string;
  repeater?: string;
  elements: ElementDef[];
  children?: ElementDef[];
}

export interface PageDef {
  name: string;
  file: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  est: string;
  sections: SectionDef[];
}

/** Wix internal component type string → WixElementType (S3 type mapping table) */
export const WIX_TYPE_MAP: Record<string, WixElementType> = {
  'wysiwyg.viewer.components.WRichText': 'Text',
  'wysiwyg.viewer.components.SiteButton': 'Button',
  'wysiwyg.viewer.components.WPhoto': 'Image',
  'wysiwyg.viewer.components.Repeater': 'Repeater',
  'wysiwyg.viewer.components.inputs.TextInput': 'Input',
  'wysiwyg.viewer.components.inputs.TextArea': 'TextBox',
  'wysiwyg.viewer.components.inputs.ComboBoxInput': 'Dropdown',
  'wysiwyg.viewer.components.StripColumnsContainer': 'Section',
  'wysiwyg.viewer.components.Column': 'Box',
  'wysiwyg.viewer.components.MediaBox': 'Box',
  'tpa.viewer.components.TPASection': 'Dataset',
  'wysiwyg.viewer.components.Video': 'Video',
  'wysiwyg.viewer.components.VideoPlayer': 'Video',
  'wysiwyg.viewer.components.Grid': 'Repeater',
  'wysiwyg.viewer.components.ToggleSwitch': 'Toggle',
  'wysiwyg.viewer.components.HtmlComponent': 'HtmlComponent',
  'wysiwyg.viewer.components.SlideShowGallery': 'Gallery',
  'wysiwyg.viewer.components.MatrixGallery': 'Gallery',
  'wysiwyg.viewer.components.inputs.DatePicker': 'DatePicker',
  'wysiwyg.viewer.components.inputs.CheckboxGroup': 'CheckboxGroup',
  'wysiwyg.viewer.components.inputs.RadioGroup': 'RadioButton',
  'wysiwyg.viewer.components.ProgressBar': 'ProgressBar',
};

export function mapWixType(internalType: string): WixElementType | null {
  return WIX_TYPE_MAP[internalType] ?? null;
}

/** Detected element from the Wix editor canvas (S3) */
export interface SelectedElement {
  compRef: unknown;      // @wix/editor ComponentRef — opaque handle for SDK calls
  internalType: string;  // Wix internal component type string
  elementType: WixElementType | null;
  currentNickname: string | null;
}

/** Panel hook-up state for a single page */
export interface PageProgress {
  pageName: string;
  hookedIds: string[];
  skippedIds: string[];
}
