import React, { useRef, useMemo, useState, useCallback } from 'react';
import { useToast } from '@hooks/useToast';
import { attachHomeMediaToken, stripHomeMediaToken, useHomeMediaToken } from './mediaUtils';
import * as VideoHandler from './VideoHandler';
import * as PdfHandler from './PdfHandler';
import * as AttachmentHandler from './AttachmentHandler';
import './RichEditor.css'; 
import { initializeIcons } from '@fluentui/react/lib/Icons';

initializeIcons(undefined, { disableWarnings: true });

import { 
  createRibbonPlugin, 
  Ribbon, 
  Rooster, 
  undoButton,
  redoButton,
  boldButton, 
  italicButton, 
  underlineButton, 
  fontButton, 
  fontSizeButton, 
  textColorButton,
  backgroundColorButton, 
  bulletedListButton, 
  numberedListButton, 
  decreaseIndentButton, 
  increaseIndentButton,
  insertLinkButton, 
  removeLinkButton,
  insertImageButton, 
  insertTableButton, 
  alignLeftButton, 
  alignCenterButton, 
  alignRightButton,
  alignJustifyButton,
  blockQuoteButton,
  clearFormatButton,
  codeButton,
  decreaseFontSizeButton,
  increaseFontSizeButton,
  ltrButton,
  rtlButton,
  setHeadingLevelButton,
  strikethroughButton,
  subscriptButton,
  superscriptButton,
  showInputDialog
} from "roosterjs-react";

import {
  formatTable,
  setTableCellShade,
  setImageBorder,
  setImageBoxShadow,
  changeImage,
  adjustImageSelection
} from 'roosterjs';

export function RichEditor({ value = '', onChange, placeholder }) {
  const toast = useToast();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('Main');
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const editorRef = useRef(null);
  const imgInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const mediaToken = useHomeMediaToken();
  const displayHtml = (html) => attachHomeMediaToken(html, mediaToken) || html;
  
  const initialValue = useMemo(() => {
    return displayHtml(value);
  }, []);

  const handleChange = useCallback((newContent) => {
    const stripped = stripHomeMediaToken(newContent);
    onChange?.(stripped);
  }, [onChange]);

  const editorSyncPlugin = useMemo(() => ({
    getName: () => 'EditorSyncPlugin',
    initialize: (editor) => {
      editorRef.current = editor;
    },
    dispose: () => {
      editorRef.current = null;
    },
    onPluginEvent: (e) => {
      if (
        e.eventType === 0 || 
        e.eventType === 'contentChanged' || 
        e.eventType === 'input'
      ) {
        if (editorRef.current) {
          handleChange(editorRef.current.getContent());
        }
      }
    }
  }), [handleChange]);

  const ribbonPlugin = useMemo(createRibbonPlugin, []);
  const plugins = useMemo(() => [ribbonPlugin, editorSyncPlugin], [ribbonPlugin, editorSyncPlugin]);
  
  // Categorized Buttons matched exactly to the screenshot's order
  const mainButtons = [
    clearFormatButton,
    boldButton,
    italicButton,
    underlineButton,
    fontButton,
    fontSizeButton,
    increaseFontSizeButton,
    decreaseFontSizeButton,
    textColorButton,
    backgroundColorButton,
    bulletedListButton,
    numberedListButton,
    decreaseIndentButton,
    increaseIndentButton,
    blockQuoteButton,
    alignLeftButton,
    alignCenterButton,
    alignRightButton,
    alignJustifyButton,
    insertLinkButton,
    removeLinkButton,
    insertTableButton,
    insertImageButton,
    superscriptButton,
    subscriptButton,
    strikethroughButton,
    setHeadingLevelButton,
    codeButton,
    ltrButton,
    rtlButton,
    {
        key: 'clearFormatCustom',
        unlocalizedText: 'Clear Format',
        iconName: 'ClearFormattingA',
        onClick: () => {}
    },
    {
        key: 'lineSpacing',
        unlocalizedText: 'Line Spacing',
        iconName: 'LineSpacing',
        onClick: () => {}
    },
    {
        key: 'bulletListCustom',
        unlocalizedText: 'Bulleted List',
        iconName: 'BulletedList',
        onClick: () => {}
    },
    {
        key: 'numberedListCustom',
        unlocalizedText: 'Numbered List',
        iconName: 'NumberedList',
        onClick: () => {}
    },
    {
        key: 'optionsDropdown',
        unlocalizedText: 'Options',
        iconName: 'Settings',
        onClick: () => {}
    },
    {
        key: 'tableEdit',
        unlocalizedText: 'Table Options',
        iconName: 'Table',
        onClick: () => {}
    },
    {
        key: 'imageEdit',
        unlocalizedText: 'Image Options',
        iconName: 'PictureCenter',
        onClick: () => {}
    }
  ];

  const textButtons = useMemo(() => [
    fontButton, fontSizeButton, boldButton, italicButton, underlineButton, strikethroughButton, 
    subscriptButton, superscriptButton, textColorButton, backgroundColorButton, 
    decreaseFontSizeButton, increaseFontSizeButton, clearFormatButton
  ], []);

  const paragraphButtons = [
    bulletedListButton,
    numberedListButton,
    decreaseIndentButton,
    increaseIndentButton,
    blockQuoteButton,
    alignLeftButton,
    alignCenterButton,
    alignRightButton,
    alignJustifyButton,
    setHeadingLevelButton,
    codeButton,
    ltrButton,
    rtlButton,
    {
        key: 'listFormatParagraph',
        unlocalizedText: 'List Format',
        iconName: 'NumberField',
        onClick: (editor, key, strings, uiUtilities) => {
            showInputDialog(uiUtilities, 'menuNameListNumberEdit', 'Set numbering value', {
                startNumber: {
                    labelKey: 'menuNameListNumberEdit',
                    unlocalizedLabel: 'Start numbering at:',
                    initValue: '1',
                    autoFocus: true
                }
            }, strings, () => {});
        }
    },
    {
        key: 'lineSpacingParagraph',
        unlocalizedText: 'Line Spacing',
        iconName: 'LineSpacing',
        dropDownMenu: { items: { 
            '1.0': '1.0', '1.15': '1.15', '1.5': '1.5', '2.0': '2.0'
        } },
        onClick: () => {}
    },
    {
        key: 'moveUpParagraph',
        unlocalizedText: 'Move Up',
        iconName: 'Up',
        onClick: () => {}
    },
    {
        key: 'moveDownParagraph',
        unlocalizedText: 'Move Down',
        iconName: 'Down',
        onClick: () => {}
    },
    {
        key: 'copyParagraph',
        unlocalizedText: 'Copy',
        iconName: 'Copy',
        onClick: () => {}
    },
    {
        key: 'pasteParagraph',
        unlocalizedText: 'Paste',
        iconName: 'Paste',
        onClick: () => {}
    }
  ];

  const insertButtons = useMemo(() => [
    insertLinkButton, removeLinkButton, insertImageButton, insertTableButton, codeButton
  ], []);

  const tableButtons = [
    insertTableButton,
    { 
      key: 'table2', 
      unlocalizedText: 'Format Table', 
      iconName: 'TableComputed', 
      dropDownMenu: { 
        items: { 
          'Table Grid': 'Table Grid',
          'Table Grid Light': 'Table Grid Light',
          'Plain Table 1': 'Plain Table 1',
          'Plain Table 2': 'Plain Table 2',
          'Plain Table 3': 'Plain Table 3',
          'Plain Table 4': 'Plain Table 4',
          'Plain Table 5': 'Plain Table 5',
          'Grid Table 1 Light': 'Grid Table 1 Light',
          'Grid Table 2': 'Grid Table 2',
          'Grid Table 3': 'Grid Table 3',
          'List Table 1 Light': 'List Table 1 Light',
          'List Table 2': 'List Table 2',
          'List Table 3': 'List Table 3'
        } 
      }, 
      onClick: (editor, key) => {
        // Map common table formats to metadata
        const formats = {
          'Table Grid': { topBorderColor: '#000', bottomBorderColor: '#000', verticalBorderColor: '#000' },
          'Table Grid Light': { topBorderColor: '#ccc', bottomBorderColor: '#ccc', verticalBorderColor: '#ccc' },
          'Plain Table 1': { topBorderColor: 'transparent', bottomBorderColor: 'transparent', verticalBorderColor: 'transparent' }
        };
        const format = formats[key] || {};
        formatTable(editor, format);
      }
    },
    { 
      ...backgroundColorButton,
      key: 'table3', 
      unlocalizedText: 'Set table shade color', 
      iconName: 'BackgroundColor',
      onClick: (editor, key) => {
        if (key) setTableCellShade(editor, key);
      } 
    },
    { 
      key: 'table4', 
      unlocalizedText: 'Table Title', 
      iconName: 'TableComputed', 
      onClick: (editor, key, strings, uiUtilities) => {
        showInputDialog(
          uiUtilities, 
          'insertTable', 
          'Insert Table', 
          {
            title: {
              labelKey: 'tableTitle',
              unlocalizedLabel: 'Title',
              initValue: '',
              autoFocus: true
            }
          }, 
          strings, 
          () => {}
        );
      } 
    },
    { 
      key: 'table5', 
      unlocalizedText: 'Options', 
      iconName: '', 
      commandBarProperties: { text: 'Options', name: 'Options', iconOnly: false }, 
      dropDownMenu: { items: { 
        'Header Row': 'Header Row',
        'First Column': 'First Column',
        'Banded Columns': 'Banded Columns',
        'Banded Rows': 'Banded Rows'
      } }, 
      onClick: () => {} 
    },
    { 
      key: 'table6', 
      unlocalizedText: 'Insert', 
      iconName: 'InsertColumnsRight', 
      dropDownMenu: { items: { 
        'Insert above': 'Insert above',
        'Insert below': 'Insert below',
        'Insert left': 'Insert left',
        'Insert right': 'Insert right'
      } }, 
      onClick: (editor, key) => {
        const opMap = {
          'Insert above': 'insertAbove',
          'Insert below': 'insertBelow',
          'Insert left': 'insertLeft',
          'Insert right': 'insertRight'
        };
        import('roosterjs').then(({ editTable }) => {
          if (opMap[key]) editTable(editor, opMap[key]);
        });
      } 
    },
    { 
      key: 'table7', 
      unlocalizedText: 'Delete', 
      iconName: 'DeleteTable', 
      dropDownMenu: { items: { 
        'Delete column': 'Delete column',
        'Delete row': 'Delete row',
        'Delete table': 'Delete table',
        'Shift cells up': 'Shift cells up',
        'Shift cells left': 'Shift cells left'
      } }, 
      onClick: (editor, key) => {
        const opMap = {
          'Delete column': 'deleteColumn',
          'Delete row': 'deleteRow',
          'Delete table': 'deleteTable',
          'Shift cells up': 'shiftCellsUp',
          'Shift cells left': 'shiftCellsLeft'
        };
        import('roosterjs').then(({ editTable }) => {
          if (opMap[key]) editTable(editor, opMap[key]);
        });
      } 
    },
    { 
      key: 'table8', 
      unlocalizedText: 'Table Border', 
      iconName: 'TableComputed', 
      dropDownMenu: { items: { 
        'All Borders': 'All Borders',
        'No Borders': 'No Borders',
        'Left Borders': 'Left Borders',
        'Right Borders': 'Right Borders',
        'Top Borders': 'Top Borders',
        'Bottom Borders': 'Bottom Borders',
        'Inside Borders': 'Inside Borders',
        'Outside Borders': 'Outside Borders'
      } }, 
      onClick: (editor, key) => {
        import('roosterjs').then(({ applyTableBorderFormat }) => {
          // RoosterJS TableBorder enum equivalent: All=1, No=2, Left=3, Right=4, Top=5, Bottom=6, Inside=7, Outside=8
          const map = {
            'All Borders': 1, 'No Borders': 2, 'Left Borders': 3, 'Right Borders': 4,
            'Top Borders': 5, 'Bottom Borders': 6, 'Inside Borders': 7, 'Outside Borders': 8
          };
          if (map[key]) applyTableBorderFormat(editor, map[key]);
        });
      }
    },
    { 
      ...textColorButton, 
      key: 'table9', 
      unlocalizedText: 'Table Border Color', 
      iconName: 'ColorSolid', 
      onClick: () => {} 
    },
    { 
      key: 'table10', 
      unlocalizedText: 'Table Border Width', 
      iconName: 'LineThickness', 
      dropDownMenu: { items: { 
        '1/4 pt': '1/4 pt', '1/2 pt': '1/2 pt', '3/4 pt': '3/4 pt', '1 pt': '1 pt', 
        '1 1/2 pt': '1 1/2 pt', '2 1/4 pt': '2 1/4 pt', '3 pt': '3 pt', '4 1/2 pt': '4 1/2 pt', '6 pt': '6 pt'
      } }, 
      onClick: () => {} 
    },
    { 
      key: 'table11', 
      unlocalizedText: 'Table Border Style', 
      iconName: 'LineStyle', 
      dropDownMenu: { items: { 
        'Solid': 'Solid', 'Dashed': 'Dashed', 'Dotted': 'Dotted', 'Double': 'Double'
      } }, 
      onClick: () => {} 
    },
    { 
      key: 'table12', 
      unlocalizedText: 'Merge', 
      iconName: '', 
      commandBarProperties: { text: 'Merge', name: 'Merge', iconOnly: false }, 
      dropDownMenu: { items: { 
        'Merge cells': 'Merge cells', 'Merge right': 'Merge right', 'Merge down': 'Merge down', 'Merge above': 'Merge above', 'Merge left': 'Merge left', 'Unmerge cells': 'Unmerge cells'
      } }, 
      onClick: (editor, key) => {
        const opMap = {
          'Merge cells': 'mergeCells', 'Merge right': 'mergeRight', 'Merge down': 'mergeBelow', 
          'Merge above': 'mergeAbove', 'Merge left': 'mergeLeft'
        };
        import('roosterjs').then(({ editTable }) => {
          if (opMap[key]) editTable(editor, opMap[key]);
        });
      }
    },
    { 
      key: 'table13', 
      unlocalizedText: 'Split', 
      iconName: '', 
      commandBarProperties: { text: 'Split', name: 'Split', iconOnly: false }, 
      dropDownMenu: { items: { 
        'Split cell horizontally': 'Split cell horizontally', 'Split cell vertically': 'Split cell vertically'
      } }, 
      onClick: (editor, key) => {
        const opMap = {
          'Split cell horizontally': 'splitHorizontally', 'Split cell vertically': 'splitVertically'
        };
        import('roosterjs').then(({ editTable }) => {
          if (opMap[key]) editTable(editor, opMap[key]);
        });
      } 
    },
    { 
      key: 'table14', 
      unlocalizedText: 'Align table cell', 
      iconName: '', 
      commandBarProperties: { text: 'Align table cell', name: 'Align table cell', iconOnly: false }, 
      dropDownMenu: { items: { 
        'Top left': 'Top left', 'Top center': 'Top center', 'Top right': 'Top right',
        'Middle left': 'Middle left', 'Middle center': 'Middle center', 'Middle right': 'Middle right',
        'Bottom left': 'Bottom left', 'Bottom center': 'Bottom center', 'Bottom right': 'Bottom right'
      } }, 
      onClick: (editor, key) => {
        const opMap = {
          'Top left': ['alignCellTop', 'alignCellLeft'], 'Top center': ['alignCellTop', 'alignCellCenter'], 'Top right': ['alignCellTop', 'alignCellRight'],
          'Middle left': ['alignCellMiddle', 'alignCellLeft'], 'Middle center': ['alignCellMiddle', 'alignCellCenter'], 'Middle right': ['alignCellMiddle', 'alignCellRight'],
          'Bottom left': ['alignCellBottom', 'alignCellLeft'], 'Bottom center': ['alignCellBottom', 'alignCellCenter'], 'Bottom right': ['alignCellBottom', 'alignCellRight']
        };
        import('roosterjs').then(({ editTable }) => {
          if (opMap[key]) {
            editTable(editor, opMap[key][0]);
            editTable(editor, opMap[key][1]);
          }
        });
      }
    },
    { 
      key: 'table15', 
      unlocalizedText: 'Align table', 
      iconName: '', 
      commandBarProperties: { text: 'Align table', name: 'Align table', iconOnly: false }, 
      dropDownMenu: { items: { 
        'Left': 'Left', 'Center': 'Center', 'Right': 'Right'
      } }, 
      onClick: (editor, key) => {
        const opMap = {
          'Left': 'alignLeft', 'Center': 'alignCenter', 'Right': 'alignRight'
        };
        import('roosterjs').then(({ editTable }) => {
          if (opMap[key]) editTable(editor, opMap[key]);
        });
      } 
    }
  ];

  const imageButtons = useMemo(() => [
    insertImageButton,
    {
      ...textColorButton,
      key: 'imageBorderColor',
      unlocalizedText: 'Image Border Color',
      iconName: 'Picture',
      commandBarProperties: { text: 'Image Border Color', iconOnly: true },
      onClick: (editor, key) => {
        if (key) setImageBorder(editor, { color: key });
      }
    },
    {
      key: 'imageBorderWidth',
      unlocalizedText: 'Image Border Width',
      iconName: 'Picture',
      commandBarProperties: { text: 'Image Border Width', iconOnly: true },
      dropDownMenu: { items: { 
        '1/4 pt': '1/4 pt', '1/2 pt': '1/2 pt', '3/4 pt': '3/4 pt', '1 pt': '1 pt', 
        '1 1/2 pt': '1 1/2 pt', '2 1/4 pt': '2 1/4 pt', '3 pt': '3 pt', '4 1/2 pt': '4 1/2 pt', '6 pt': '6 pt'
      } },
      onClick: (editor, key) => {
        const pt = key.replace(' pt', '');
        const width = pt === '1/4' ? '0.25pt' : pt === '1/2' ? '0.5pt' : pt === '3/4' ? '0.75pt' : pt === '1 1/2' ? '1.5pt' : pt === '2 1/4' ? '2.25pt' : pt === '4 1/2' ? '4.5pt' : `${pt}pt`;
        setImageBorder(editor, { width });
      }
    },
    {
      key: 'imageBorderStyle',
      unlocalizedText: 'Image Border Style',
      iconName: 'BorderDash',
      commandBarProperties: { text: 'Image Border Style', iconOnly: true },
      dropDownMenu: { items: { 
        'Solid': 'Solid', 'Dashed': 'Dashed', 'Dotted': 'Dotted', 'Double': 'Double'
      } },
      onClick: (editor, key) => {
        setImageBorder(editor, { style: key.toLowerCase() });
      }
    },
    {
      key: 'removeImageBorder',
      unlocalizedText: 'Remove Image Border',
      iconName: 'Cancel',
      commandBarProperties: { text: 'Remove Image Border', iconOnly: true },
      onClick: (editor) => {
        setImageBorder(editor, null);
      }
    },
    {
      key: 'changeImage',
      unlocalizedText: 'Change Image',
      iconName: 'ImageSearch',
      commandBarProperties: { text: 'Change Image', iconOnly: true },
      onClick: () => {}
    },
    {
      key: 'imageShadow',
      unlocalizedText: 'Image Shadow',
      iconName: 'Picture',
      commandBarProperties: { text: 'Image Shadow', iconOnly: true },
      dropDownMenu: { items: { 
        'noShadow': 'noShadow', 'bottomRight': 'bottomRight', 'bottom': 'bottom', 'bottomLeft': 'bottomLeft',
        'right': 'right', 'center': 'center', 'left': 'left', 'topRight': 'topRight', 'top': 'top', 'topLeft': 'topLeft'
      } },
      onClick: (editor, key) => {
        const shadowMap = {
          'noShadow': '',
          'bottomRight': '2px 2px 5px rgba(0,0,0,0.5)',
          'bottom': '0px 2px 5px rgba(0,0,0,0.5)',
          'bottomLeft': '-2px 2px 5px rgba(0,0,0,0.5)',
          'right': '2px 0px 5px rgba(0,0,0,0.5)',
          'center': '0px 0px 5px rgba(0,0,0,0.5)',
          'left': '-2px 0px 5px rgba(0,0,0,0.5)',
          'topRight': '2px -2px 5px rgba(0,0,0,0.5)',
          'top': '0px -2px 5px rgba(0,0,0,0.5)',
          'topLeft': '-2px -2px 5px rgba(0,0,0,0.5)'
        };
        setImageBoxShadow(editor, shadowMap[key] || '');
      }
    },
    {
      key: 'imageCrop',
      unlocalizedText: 'Crop',
      iconName: 'Crop',
      commandBarProperties: { text: 'Crop', iconOnly: true },
      onClick: () => {}
    },

    {
      key: 'imageRotate',
      unlocalizedText: 'Rotate image',
      iconName: 'Sync',
      commandBarProperties: { text: 'Rotate image', iconOnly: true },
      dropDownMenu: { items: { 'Left': 'Left', 'Right': 'Right' } },
      onClick: (editor, key) => {
        const selectedImg = editor.getElementAtCursor('img, span[class^="rooster-image"] img');
        if (selectedImg && selectedImg.tagName === 'IMG') {
           const rotate = key === 'Left' ? 'rotate(-90deg)' : 'rotate(90deg)';
           selectedImg.style.transform = selectedImg.style.transform === rotate ? '' : rotate;
        }
      }
    },
    {
      key: 'imageFlip',
      unlocalizedText: 'Flip image',
      iconName: 'Sort',
      commandBarProperties: { text: 'Flip image', iconOnly: true },
      dropDownMenu: { items: { 'Flip Horizontally': 'Flip Horizontally', 'Flip Vertically': 'Flip Vertically' } },
      onClick: (editor, key) => {
        const selectedImg = editor.getElementAtCursor('img, span[class^="rooster-image"] img');
        if (selectedImg && selectedImg.tagName === 'IMG') {
           const scale = key === 'Flip Horizontally' ? 'scaleX(-1)' : 'scaleY(-1)';
           selectedImg.style.transform = selectedImg.style.transform === scale ? '' : scale;
        }
      }
    },
    {
      key: 'imageSize',
      unlocalizedText: 'Size',
      iconName: 'SizeLegacy',
      commandBarProperties: { text: 'Size', iconOnly: true },
      dropDownMenu: { items: { 'Best fit': 'Best fit', 'Small': 'Small', 'Medium': 'Medium', 'Original': 'Original' } },
      onClick: (editor, key) => {
        const selectedImg = editor.getElementAtCursor('img, span[class^="rooster-image"] img');
        if (selectedImg && selectedImg.tagName === 'IMG') {
           if (key === 'Best fit') { selectedImg.style.width = '100%'; selectedImg.style.height = 'auto'; }
           else if (key === 'Small') { selectedImg.style.width = '25%'; selectedImg.style.height = 'auto'; }
           else if (key === 'Medium') { selectedImg.style.width = '50%'; selectedImg.style.height = 'auto'; }
           else if (key === 'Original') { selectedImg.style.width = ''; selectedImg.style.height = ''; }
        }
      }
    }
  ], []);

  // Global right-side buttons handled inline to access state

  const handleContainerBlur = useCallback(() => {
    if (editorRef.current) {
      handleChange(editorRef.current.getContent());
    }
  }, [handleChange]);

  // Opens fullscreen then triggers the file picker
  const handleMediaBtnClick = useCallback((inputRef) => {
    setIsFullscreen(true);
    // Small delay so fullscreen renders before focus shifts
    setTimeout(() => inputRef.current?.click(), 80);
  }, []);

  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editorRef.current) return;
    e.target.value = '';
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = `<img src="${ev.target.result}" style="max-width:100%;height:auto;" />`;
        editorRef.current.insertContent(img);
        handleChange(editorRef.current.getContent());
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('Failed to insert image');
    }
  }, [handleChange, toast]);

  const handleVideoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editorRef.current) return;
    e.target.value = '';
    if (!VideoHandler.isSupportedVideoFile(file)) {
      toast.error('Unsupported video format. Use MP4, WebM or OGG.');
      return;
    }
    try {
      toast.info?.('Uploading video…');
      const result = await VideoHandler.ingestFile(file);
      const markup = VideoHandler.buildVideoMarkup({ url: result.url, filename: file.name, filesize: file.size, mime: file.type });
      editorRef.current.insertContent(markup);
      handleChange(editorRef.current.getContent());
    } catch (err) {
      toast.error('Video upload failed');
    }
  }, [handleChange, toast]);

  const handlePdfUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editorRef.current) return;
    e.target.value = '';
    try {
      toast.info?.('Uploading PDF…');
      const result = await PdfHandler.ingestFile(file);
      const markup = PdfHandler.buildPdfMarkup({ id: result.id, url: result.url, filename: file.name, filesize: file.size });
      editorRef.current.insertContent(markup);
      handleChange(editorRef.current.getContent());
    } catch (err) {
      toast.error('PDF upload failed');
    }
  }, [handleChange, toast]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editorRef.current) return;
    e.target.value = '';
    if (!AttachmentHandler.isSupportedAttachment(file)) {
      toast.error('Unsupported file type. Use doc, docx, xls, xlsx, ppt, pptx or zip.');
      return;
    }
    try {
      toast.info?.('Uploading file…');
      const result = await AttachmentHandler.ingestFile(file);
      const markup = AttachmentHandler.buildAttachmentMarkup({ id: result.id, url: result.url, filename: file.name, filesize: file.size, mime: file.type });
      editorRef.current.insertContent(markup);
      handleChange(editorRef.current.getContent());
    } catch (err) {
      toast.error('File upload failed');
    }
  }, [handleChange, toast]);

  const tabs = ['Main', 'Text', 'Paragraph', 'Insert', 'Table', 'Image'];

  const getActiveButtons = () => {
    switch (activeTab) {
      case 'Main': {
        const all = [...mainButtons, ...tableButtons, ...imageButtons];
        // Deduplicate buttons (like insertImageButton) which exist in both main and contextual arrays
        return all.filter((btn, idx) => all.indexOf(btn) === idx);
      }
      case 'Text': return textButtons;
      case 'Paragraph': return paragraphButtons;
      case 'Insert': return insertButtons;
      case 'Table': return tableButtons;
      case 'Image': return imageButtons;
      default:
        return mainButtons;
    }
  };

  // We removed maroonBase and maroonLight; styling will use CSS variables.

  return (
    <div 
      className={`rte-root rooster-custom-container ${isFullscreen ? 'rte-fullscreen' : ''}`} 
      style={isFullscreen ? { zIndex: 9999, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' } : {}}
      onBlur={handleContainerBlur}
      onKeyUp={handleContainerBlur}
    >
      <div style={{ background: 'var(--bg-secondary, #f8fafc)', padding: '0', display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
        
        {/* Top Row: Tabs + Global Tools */}
        {isFullscreen && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
            
            {/* Left side: Tabs */}
            <div style={{ display: 'flex', gap: '6px', padding: '8px 16px 0 16px' }}>
              {tabs.map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 18px',
                    height: '38px',
                    backgroundColor: activeTab === tab ? 'var(--surface-primary)' : 'var(--surface-primary)',
                    color: activeTab === tab ? 'var(--c-primary)' : 'var(--text-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderBottom: activeTab === tab ? '1px solid var(--surface-primary)' : 'none',
                    borderRadius: '8px 8px 0 0',
                    cursor: 'pointer',
                    fontWeight: activeTab === tab ? '600' : '500',
                    fontSize: '13px',
                    zIndex: activeTab === tab ? 2 : 1,
                    outline: 'none',
                    marginBottom: activeTab === tab ? '-1px' : '0',
                    boxShadow: activeTab === tab ? '0 -2px 6px rgba(0, 0, 0, 0.02)' : 'none'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Right side: Global Actions */}
            <div style={{ display: 'flex', alignItems: 'center', paddingRight: '8px' }}>
              <Ribbon plugin={ribbonPlugin} buttons={[undoButton, redoButton]} />
              <Ribbon plugin={ribbonPlugin} buttons={[
                {
                  key: 'zoomDropdown',
                  unlocalizedText: 'Zoom',
                  iconName: 'ZoomIn',
                  dropDownMenu: {
                    items: {
                      '50': '50%',
                      '75': '75%',
                      '100': '100%',
                      '200': '200%'
                    }
                  },
                  onClick: () => {}
                },
                {
                  key: 'darkModeToggle',
                  unlocalizedText: 'Dark Mode',
                  iconName: 'ClearNight',
                  onClick: () => {}
                },
                {
                  key: 'exportDropdown',
                  unlocalizedText: 'Export',
                  iconName: 'PageRight',
                  dropDownMenu: {
                    items: {
                      'html': 'as HTML',
                      'html_fast': 'as HTML (fast version)',
                      'text': 'as Plain Text'
                    }
                  },
                  onClick: () => {}
                }
              ]} />
              <Ribbon plugin={ribbonPlugin} buttons={[
                {
                  key: 'fullScreenToggle',
                  unlocalizedText: isFullscreen ? 'Exit Full Screen' : 'Full Screen',
                  iconName: isFullscreen ? 'BackToWindow' : 'FullScreen',
                  onClick: () => setIsFullscreen(!isFullscreen)
                }
              ]} />
            </div>
          </div>
        )}

        {/* Toolbar: Non-fullscreen — 4 row layout matching the reference image */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flexGrow: 1, minWidth: 0 }}>
             {!isFullscreen ? (
                // ── Non-fullscreen compact toolbar ──
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0', width: '100%' }}>
                  {/* Row 1: Undo/Redo + Text formatting (B/I/U/S/font/size…) */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--border-primary, #e2e8f0)', padding: '2px 4px' }}>
                    <Ribbon plugin={ribbonPlugin} buttons={[undoButton, redoButton]} />
                    <Ribbon plugin={ribbonPlugin} buttons={textButtons} />
                  </div>
                  {/* Row 2: Paragraph / Alignment / List formatting */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--border-primary, #e2e8f0)', padding: '2px 4px' }}>
                    <Ribbon plugin={ribbonPlugin} buttons={paragraphButtons} />
                  </div>
                  {/* Row 3: Insert buttons | Image · Video · PDF labeled buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', borderBottom: '1px solid var(--border-primary, #e2e8f0)', padding: '2px 4px' }}>
                    <Ribbon plugin={ribbonPlugin} buttons={insertButtons} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '6px' }}>
                      {/* Image */}
                      <button type="button" onClick={() => handleMediaBtnClick(imgInputRef)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', border: '1px solid var(--border-primary)', borderRadius: '4px', background: 'var(--surface-primary)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="14" height="14" rx="2"/><circle cx="5.5" cy="5.5" r="1.5"/><path d="M1 11l4-4 3 3 2-2 5 5"/></svg>
                        Image
                      </button>
                      {/* Video */}
                      <button type="button" onClick={() => handleMediaBtnClick(videoInputRef)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', border: '1px solid var(--border-primary)', borderRadius: '4px', background: 'var(--surface-primary)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="10" height="10" rx="1.5"/><path d="M11 6l4-2v8l-4-2V6z"/></svg>
                        Video
                      </button>
                      {/* PDF */}
                      <button type="button" onClick={() => handleMediaBtnClick(pdfInputRef)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', border: '1px solid var(--border-primary)', borderRadius: '4px', background: 'var(--surface-primary)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6L9 1z"/><path d="M9 1v5h5"/></svg>
                        PDF
                      </button>
                    </div>
                  </div>
                  {/* Row 4: File + Table align buttons + Table | Fullscreen (green) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '2px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {/* File */}
                      <button type="button" onClick={() => handleMediaBtnClick(fileInputRef)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', border: '1px solid var(--border-primary)', borderRadius: '4px', background: 'var(--surface-primary)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2a1 1 0 011-1h7l4 4v9a1 1 0 01-1 1H3a1 1 0 01-1-1V2z"/><path d="M9 1v4h4"/></svg>
                        File
                      </button>
                      <Ribbon plugin={ribbonPlugin} buttons={[alignLeftButton, alignCenterButton, alignRightButton, insertTableButton]} />
                    </div>
                    {/* Fullscreen green button */}
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(true)}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '4px', border: 'none', background: '#006633', color: '#fff', cursor: 'pointer', flexShrink: 0 }}
                      title="Full Screen"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1h5v1.5H2.5V7H1V1zm9 0h5v6h-1.5V2.5H10V1zM1 9h1.5v4.5H7V15H1V9zm13 4.5H10V15h5V9h-1.5v4.5z"/></svg>
                    </button>
                  </div>
                </div>
             ) : (
                // Fullscreen mode format toolbar
                <div style={{ width: '100%' }}>
                  <Ribbon plugin={ribbonPlugin} buttons={getActiveButtons()} />
                </div>
             )}
          </div>
        </div>

        {/* Hidden file inputs for media upload */}
        <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
        <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/ogg" style={{ display: 'none' }} onChange={handleVideoUpload} />
        <input ref={pdfInputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handlePdfUpload} />
        <input ref={fileInputRef} type="file" accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" style={{ display: 'none' }} onChange={handleFileUpload} />
        
        {/* Fullscreen bottom border line under tools */}
        {isFullscreen && <div style={{ borderBottom: '1px solid var(--border-primary)', marginTop: '4px', marginBottom: '4px' }} />}
      </div>
      
      {/* Editor area: In fullscreen split left=HTML preview, right=editor */}
      {isFullscreen ? (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
          {/* Left: Generated HTML Preview */}
          <div style={{
            flex: '0 0 340px',
            borderRight: '1px solid var(--border-primary)',
            background: 'var(--bg-secondary)',
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Generated HTML Preview</div>
            <pre style={{
              fontSize: '11px',
              color: 'var(--text-primary)',
              background: 'var(--surface-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: '6px',
              padding: '12px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              flex: 1,
              margin: 0,
              overflowY: 'auto',
              fontFamily: 'monospace'
            }}>{value || '<!-- No content yet -->'}</pre>
          </div>
          {/* Right: Editor */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#ffffff' }}>
              <Rooster 
                plugins={plugins} 
                initialContent={initialValue} 
              />
            </div>
            {/* ESC button — bottom right of fullscreen */}
            <button
              className="rte-fullscreen-exit-hint"
              onClick={() => setIsFullscreen(false)}
            >
              Press ESC or click here to exit fullscreen
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ border: '1px solid var(--border-primary)', minHeight: '300px', padding: '16px', background: '#ffffff', borderBottomLeftRadius: showHtmlPreview ? '0' : '6px', borderBottomRightRadius: showHtmlPreview ? '0' : '6px', borderBottom: showHtmlPreview ? 'none' : undefined, overflowY: 'auto' }}>
            <Rooster 
              plugins={plugins} 
              initialContent={initialValue} 
            />
          </div>
          {/* Show generated HTML preview toggle */}
          <div style={{ borderTop: showHtmlPreview ? 'none' : '1px solid var(--border-primary)', border: '1px solid var(--border-primary)', borderTop: showHtmlPreview ? 'none' : '1px solid var(--border-primary)', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px', background: 'var(--surface-primary)' }}>
            <button
              type="button"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 14px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--c-primary)',
                borderBottom: showHtmlPreview ? '1px solid var(--border-primary)' : 'none'
              }}
              onClick={() => setShowHtmlPreview(p => !p)}
            >
              {showHtmlPreview ? 'Hide generated HTML preview' : 'Show generated HTML preview'}
            </button>
            {showHtmlPreview && (
              <pre style={{
                margin: 0,
                padding: '12px 14px',
                fontSize: '11px',
                color: 'var(--text-primary)',
                background: 'var(--bg-secondary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                maxHeight: '160px',
                overflowY: 'auto',
                borderBottomLeftRadius: '6px',
                borderBottomRightRadius: '6px'
              }}>{value || '<!-- No content yet -->'}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default RichEditor;
