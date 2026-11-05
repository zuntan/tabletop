import { uiErrorMessage } from './i18n/errors';
import { localizedLaunchName } from './desk-launch-name';
import { languageChangeEvent, t, getUiLanguage } from './i18n';
import { translateUi, uiAttribute, uiText, type UiKey } from './i18n/dom';
import {initialFocusTarget} from './initial-focus';
import {KeyboardGeometryEdit} from './keyboard-geometry';
import {newPartGridSize} from './grid';
import {snapInterval} from './grid-settings';
import {MAX_ASSET_BYTES,checkAssetBytes} from './data-limits';
import {encodeDeskFile,decodeDeskFile} from './desk-file';
import {bytesDataUrl,dataBytes} from './binary-envelope';
import {createDeskOverview} from './desk-overview';
import {createTopbarCollapse} from './topbar-collapse';
import {MAX_PDF_EXPORT_BYTES} from './pdf-export';
import {createStrokeWidthMode} from './stroke-width-mode';
import {createWayfinderNavigation} from './wayfinder-navigation';
import {captureBounds} from './desk-capture';
import {deskSceneRaster} from './desk-pdf';
import {browserPinFitOperations} from './pin-fit';
import {createCaptureCamera} from './capture-camera';
import {createDoodleEditor} from './doodle-editor';
import {emptyDoodle,doodleSource} from './doodle-values';
import {updateQrCardLayout} from './qr-card';
import {drawLinkDisplay,isUrlLink} from './link-display';
import {drawQrCard} from './qr-card';
import {defaultQrText,renderQrCode} from './qr-code';
import {createPinNavigation,pinNeighbours,pinRoot} from './pin-navigation';
import {createLineInput} from './line-input';
import {rulerCreateOperations,rulerFor,rulerDropTarget,rulerTarget} from './ruler-layout';
import {drawRuler} from './ruler-drawing';
import {pagesMode} from './runtime-mode';
import {pagesFileRequest} from './pages-desk';
import './pages-mode.css';
import {createOriginGuides} from './origin-guides';
import {partClipboardToken,clipboardTransferSchema} from './clipboard-transfer';
import {applyTitleBackground} from './desk-appearance';
import {fileCreateOperations,fileFor,fileGroup} from './clear-files';
import {drawClearFile} from './clear-file-drawing';
import {createDeskToast} from './desk-toast';
import { createBellControls } from './bell-controls';
import { initialPartSize, initialImageSize, centeredPartPoint, initialLinePoints, initialLineDelta } from './initial-part-layout';
import { deskPdf, deskPng } from './desk-pdf';
import { createCutoutControls } from './cutout-controls';
import { drawCutout } from './cutout-drawing';
import { cutoutTarget, cutoutSourceObject } from './logical-cutout';
import { BhDeletion, bhDeleteControls, DELETE_MODES, type DeleteMode } from './bh-delete';
import { confirmAction, isConfirmDialogOpen, cancelConfirmDialog } from './confirm-dialog';
import { openBhPreview } from './bh-preview';
import { rasterPointedCard } from './part-raster';
import { pointedMove, ObjectMoveAnimator } from './object-move-animation';
import { drawClip } from './clip-drawing';
import { drawClipMembershipGuides } from './clip-membership';
import { drawStickers } from './stickers';
import { createStickerControls } from './sticker-controls';
import './stickers.css';
import { bundleOperations, unbundleOperations, clipFor, clipGroup, clipFollower, clipDropTarget, clipTarget } from './clip-bundles';
import { createPropControls } from './prop-controls';
import { drawStamp } from './stamps';
import { createStampControls } from './stamp-controls';
import { createShapePicker, createTextFitPicker } from './shape-picker';
import { isShapeType, shapePaths } from './shape-definitions';
import { createCalloutPicker } from './callout-picker';
import { calloutPath, drawCalloutLeader } from './text-callouts';
import { isPinAttachmentTarget,attachmentOffset } from './pin-attachments';
import { createDeskMenu } from './desk-menu';
import './style.css';
import { Desk, dispatch, objectSchema, type DeskObject, type Operation } from './model';
import { anchorPoint, bounds, endpoints, isConnector, isShape } from './geometry';
import { createColorControls } from './color-controls';
import { buildJunctionRounding } from './junction-rounding';
import { drawMermaidCard, renderMermaid } from './mermaid-card';
import { drawConnector, drawShapeText, drawEndpointHandles, drawSnapTargets, updateScenePreview } from './diagram-drawing';
import { gestureOperations, gesturePreview, endpointSnap, endpointDragPoint, type Gesture } from './diagram-gestures';
import { createPropertyEditor } from './property-editor';
import { frameColors } from './frame-colors';
import { createUiThemeButton, getUiTheme, setUiTheme } from './ui-theme';
import './ui-theme.css';
import './diagram.css';
import './authoring.css';
import { createInlineEditor } from './inline-editor';
import { createAuthoring } from './authoring';
import { initialSettings, type Series } from './settings';
import { createFormatControls } from './format-controls';
import { groupToolbar, iconButton } from './toolbar';
import { drawLabelDescription, labelVisualBounds } from './label-description';
import { gridPoint, gridOrigin } from './grid';
import { pinPath } from './pin-shape';
import { drawOpenLink, drawDeskLinkIcon } from './link-card';
import { readClipboardContent, svgClipboardFile, type ClipboardContent } from './clipboard';
import { PartClipboard, partClipboardType, singleClipboardUrl } from './part-clipboard';
import { effectivePinVisibility, pinTransform, pinScreenObject, pinThreadMembers, pinVisibilityNames, type PinVisibility } from './pin-series';
import { drawMarkdown } from './markdown';
import { createActivityLed } from './activity-led';
import { createDeskBackground } from './desk-background';
import './activity-led.css';
import { measureDeskText } from './text-measure';
import './markdown.css';
import { createSidebar } from './sidebar';
import './sidebar.css';
import { selectedConnection } from './connection-creation';
import { drawAiPointing } from './ai-pointing';
import { createReactionControls, createReactionSizeControls, drawReactions } from './reactions';
import './reactions.css';
import { createDeskFileControls } from './desk-file-controls';
import { IMAGE_TITLE_HEIGHT } from './image-geometry';
import { headSelectedProp, propSelectionBounds } from './prop-selection';
import { wayfinderRoute,lineRoute,type WayfinderRoute } from './wayfinder-route';
import {wayfinderStartSchema,type WayfinderStartInput} from './wayfinder-input';
import {createWayfinderMap} from './wayfinder-map';
import { WayfinderTravel,WayfinderCancelled,type WayfinderStopReason } from './wayfinder-travel';
import { drawWayfinder } from './wayfinder-drawing';
import { BrowserConnection } from './pairing-client';
import { createDeskIdentityControls } from './desk-identity-controls';
import './desk-identity.css';
import { createThinkingMode } from './thinking-mode';
import { headerIcon } from './header-icon';
import { addFormNumberPresets, addPresetPalette } from './number-presets';
import { createLineStylePicker } from './line-style-picker';
import { createEndpointPicker } from './endpoint-picker';
import { parseConnectionUrl, ConnectionUrlError } from './connection-url';
import { randomUuid } from './portable-crypto';
import { connectionControls } from './connection-controls';
import { fittedCamera } from './focus-camera';
import { cameraView, movedCamera, type CameraMove } from './camera-control';
import { HumanScrollGuard } from './camera-activity';
import { CameraAnimator, type AnimationOptions } from './camera-animation';
import { lockOperations, lockSelectionState } from './object-lock';
import { createLockControls } from './lock-controls';
import { drawLockedSelection } from './lock-drawing';

const creationSettings = initialSettings();
creationSettings.series[0].name = t('creation:digits');
const desk = new Desk(creationSettings);
const doodleEditor=createDoodleEditor((id,patch)=>{execute([{kind:'update',id,patch}]);render();},notify);
const partClipboard = new PartClipboard();
const app = document.querySelector<HTMLDivElement>('#app')!;
document.documentElement.dataset.appMode=pagesMode?'pages':'desk';
app.innerHTML = `
  <header><div class="brand">Tabletop <small data-i18n="shell:tagline"></small></div>
    <span id="connection" class="badge" data-i18n="shell:disconnected"></span><span id="revision">rev. 0</span>
    <button id="undo" data-i18n="shell:undo"></button><button id="redo" data-i18n="shell:redo"></button>
  </header>
  <nav data-i18n-aria-label="shell:addTools">
    <button data-add="rect" data-i18n="shell:rectButton"></button><button data-add="roundedRect" data-i18n="shell:roundedRectButton"></button><button data-add="ellipse" data-i18n="shell:ellipseButton"></button>
    <button data-add="line" data-i18n="shell:lineButton"></button><button data-add="arrow" data-i18n="shell:arrowButton"></button>
    <button data-add="text" data-i18n="shell:cardButton"></button><button id="image" data-i18n="shell:imageButton"></button><button data-add="mermaid">Mermaid</button><button data-add="qrcode" data-i18n="shell:qrCode"></button>
    <button id="clipboard" data-i18n-title="shell:paste" data-i18n-aria-label="shell:paste" data-i18n="shell:pasteButton"></button>
    <button data-add="web" data-i18n="shell:webPage"></button><button data-add="link" data-i18n="shell:link"></button>
    <button id="numbering" data-i18n="shell:pin"></button><div id="authoring-tools"></div>
    <span class="spacer"></span><button id="zoom-out" data-i18n-aria-label="shell:zoomOut">−</button>
    <button id="zoom-reset">100%</button><button id="zoom-in" data-i18n-aria-label="shell:zoomIn">＋</button><button id="fit" data-i18n="shell:fitAll"></button>
  </nav>
  <main>
    <section id="workspace" data-i18n-aria-label="shell:workspace">
      <svg id="canvas" xmlns="http://www.w3.org/2000/svg" role="img" data-i18n-aria-label="shell:canvas" tabindex="0">
        <defs><pattern id="dots" x="-12" y="-12" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="2" fill="#cbd5e1"/><path d="" fill="none" stroke="#cbd5e1" stroke-width="1" display="none"/></pattern></defs>
        <rect id="desk-background" width="100%" height="100%" fill="#f8fafc"/>
        <rect id="desk-wallpaper" width="100%" height="100%" fill="none"/>
        <rect id="desk-grid" width="100%" height="100%" fill="url(#dots)"/>
        <g id="viewport"><g id="objects"></g><g id="overlays"></g></g>
      </svg>
      <div id="empty"><span data-i18n="shell:emptyTitle"></span><small data-i18n="shell:emptyHint"></small></div>
      <div class="hint"><button id="hint-toggle" type="button" aria-controls="operation-hint" aria-expanded="true" data-i18n-aria-label="shell:hideHint" data-i18n-title="shell:hideHint">‹</button><span id="operation-hint" data-i18n="shell:operationHint"></span></div>
    </section>
    <aside>
      <section id="series-panel" hidden></section>
      <section><h2 data-i18n="shell:selectionProperties"></h2><div id="selected-label" data-i18n="shell:nothingSelected"></div>
        <form id="properties" hidden>
          <label><span data-i18n="shell:startX"></span><input name="x" type="number" step="any"></label><label><span data-i18n="shell:startY"></span><input name="y" type="number" step="any"></label>
          <label hidden><span data-i18n="shell:endX"></span><input name="x2" type="number" step="any" disabled></label><label hidden><span data-i18n="shell:endY"></span><input name="y2" type="number" step="any" disabled></label>
          <label><span data-i18n="shell:width"></span><input name="width" type="number" min="1" step="any"></label><label><span data-i18n="shell:height"></span><input name="height" type="number" min="1" step="any"></label>
          <label hidden><span data-i18n="shell:fill"></span><input name="fill" type="text"></label><label hidden><span data-i18n="shell:line"></span><input name="stroke" type="text"></label>
          <label><span data-i18n="shell:fillTransparency"></span><input name="fillOpacity" type="number" min="0" max="100" step="1"></label>
          <label><span data-i18n="shell:strokeWidth"></span><input name="strokeWidth" type="number" min="0" step="any"></label><label><span data-i18n="shell:fontSize"></span><input name="fontSize" type="number" min="1"></label>
          <label hidden><span data-i18n="shell:widthMode"></span><input name="fixedWidth" type="hidden" value="false"></label>
          <label hidden><span data-i18n="shell:rounding"></span><input name="junctionRounding" type="number" min="0" max="100000" step="any" disabled></label>
          <label hidden><span data-i18n="shell:lineStyle"></span><select name="dash" disabled><option value="solid" data-i18n="shell:solid"></option><option value="dashed" data-i18n="shell:dashed"></option><option value="dotted" data-i18n="shell:dotted"></option></select></label>
          <label hidden><span data-i18n="shell:startMarker"></span><select name="startMarker" disabled><option value="none" data-i18n="shell:none"></option><option value="arrow" data-i18n="shell:arrow"></option><option value="circle" data-i18n="shell:circle"></option><option value="diamond" data-i18n="shell:diamond"></option></select></label>
          <label hidden><span data-i18n="shell:endMarker"></span><select name="endMarker" disabled><option value="none" data-i18n="shell:none"></option><option value="arrow" data-i18n="shell:arrow"></option><option value="circle" data-i18n="shell:circle"></option><option value="diamond" data-i18n="shell:diamond"></option></select></label>
          <label hidden><span data-i18n="shell:cornerRadius"></span><input name="cornerRadius" type="number" min="0" step="any"></label>
          <label hidden><span data-i18n="shell:padding"></span><input name="padding" type="number" min="0" step="any"></label>
          <label hidden><span data-i18n="shell:textFit"></span><select name="textFit" disabled><option value="fixed" hidden data-i18n="shell:fixedText"></option><option value="auto" data-i18n="shell:autoText"></option><option value="shrink" data-i18n="shell:shrinkText"></option></select></label>
          <label hidden><span data-i18n="shell:callout"></span><select name="calloutMode" disabled><option value="none" data-i18n="shell:none"></option><option value="speech" data-i18n="shell:speech"></option><option value="thought" data-i18n="shell:thought"></option><option value="leader" data-i18n="shell:leader"></option></select></label>
          <label class="wide" hidden><span data-i18n="shell:linkDisplay"></span><select name="linkDisplay" hidden><option value="url" data-i18n="shell:urlText"></option><option value="qr" data-i18n="shell:qrCode"></option></select><span class="wayfinder-mode" role="group" data-i18n-aria-label="shell:linkDisplay"><button type="button" data-link-display="url" aria-pressed="true" data-i18n="shell:urlText"></button><button type="button" data-link-display="qr" aria-pressed="false" data-i18n="shell:qrCode"></button></span></label>
          <label hidden><span data-i18n="shell:wayfinderMode"></span><select name="wayfinderMode" hidden><option value="move" data-i18n="shell:move"></option><option value="tour" data-i18n="shell:tour"></option></select><span class="wayfinder-mode" role="group" data-i18n-aria-label="shell:wayfinderMode"><button type="button" data-wayfinder-mode="move" aria-pressed="true" data-i18n="shell:move"></button><button type="button" data-wayfinder-mode="tour" aria-pressed="false" data-i18n="shell:tour"></button></span></label>
          <label hidden><span data-i18n="shell:headSelection"></span><select name="propSelection" hidden><option value="normal" data-i18n="shell:normalSelection"></option><option value="head" data-i18n="shell:headSelection"></option></select><button id="prop-head-selection" type="button" role="switch" data-i18n-aria-label="shell:headSelection" aria-checked="false"><span class="thinking-switch-track" aria-hidden="true"></span><span class="thinking-switch-state">OFF</span></button></label>
          <label hidden><span data-i18n="shell:layout"></span><select name="rulerMode"><option value="free" data-i18n="shell:free"></option><option value="gap" data-i18n="shell:gap"></option><option value="center" data-i18n="shell:center"></option></select></label>
          <label hidden><span data-i18n="shell:rulerMaterial"></span><select name="rulerMaterial"><option value="acrylic" data-i18n="shell:acrylic"></option><option value="bamboo" data-i18n="shell:bamboo"></option><option value="steel" data-i18n="shell:steel"></option></select></label>
          <label hidden><span data-i18n="shell:rulerThickness"></span><select name="rulerThickness"><option value="24">24</option><option value="36">36</option><option value="48">48</option></select></label>
          <label hidden><span data-i18n="shell:clipSize"></span><input name="clipSize" type="number" min="1" max="100000" step="any"></label>
          <label hidden><span data-i18n="shell:sizeMode"></span><select name="clipAutoSize"><option value="false" data-i18n="shell:manualSize"></option><option value="true" data-i18n="shell:autoSize"></option></select></label>
          <label hidden><span data-i18n="shell:clipAnchor"></span><select name="clipAnchor"><option value="top-left" data-i18n="shell:topLeft"></option><option value="top" data-i18n="shell:top"></option><option value="top-right" data-i18n="shell:topRight"></option><option value="right" data-i18n="shell:right"></option><option value="bottom-right" data-i18n="shell:bottomRight"></option><option value="bottom" data-i18n="shell:bottom"></option><option value="bottom-left" data-i18n="shell:bottomLeft"></option><option value="left" data-i18n="shell:left"></option></select></label>
          <label hidden><span data-i18n="shell:clipStyle"></span><select name="clipStyle"><option value="binder" data-i18n="shell:binder"></option><option value="wire" data-i18n="shell:wire"></option></select></label>
          <label hidden><span data-i18n="shell:offsetMode"></span><select name="clipOffsetMode"><option value="fixed" data-i18n="shell:fixedOffset"></option><option value="percent" data-i18n="shell:previousPercent"></option><option value="base-short-side" data-i18n="shell:firstPercent"></option></select></label>
          <label hidden><span data-i18n="shell:clipPercent"></span><input name="clipOffsetPercent" type="number" min="0" step="any"></label>
          <label hidden><span data-i18n="shell:clipOffset"></span><input name="clipOffset" type="number" min="0" step="any"></label>
          <label class="wide"><span data-i18n="shell:text"></span><textarea name="text" rows="3"></textarea></label>
          <button id="card-fit-text" class="wide" type="button" hidden data-i18n="authoring:fit"></button>
          <label class="wide" hidden><span data-i18n="shell:qrText"></span><textarea name="qrText" rows="8" spellcheck="false" disabled></textarea></label>
          <label class="wide" hidden><span data-i18n="shell:mermaidSource"></span><textarea name="mermaidSource" rows="8" spellcheck="false" disabled></textarea></label>
          <label class="wide">URL<input name="url" type="url"></label>
        </form>
        <button id="text-measure" type="button" hidden data-i18n="shell:measureText"></button>
        <small id="text-measure-result" role="status" hidden></small>
        <div id="color-controls" hidden></div>
        <div id="reaction-controls" hidden></div>
        <small data-i18n="shell:propertyHint"></small>
        <div class="actions"><button id="front" data-i18n="shell:front"></button><button id="back" data-i18n="shell:back"></button><button id="delete" data-i18n="shell:delete"></button></div>
        <a id="open-url" hidden target="_blank" rel="noopener noreferrer"><span data-i18n="shell:openOriginal"></span></a>
      </section>
      <section><h2><span data-i18n="shell:objectList"></span><span id="count">0</span></h2><div id="object-list"></div></section>
      <section><h2 data-i18n="shell:sharedHistory"></h2><div id="history"></div></section>
      <section><h2 data-i18n="shell:mcpConnection"></h2><p data-i18n="shell:connectionHelp"></p>
        <p id="connection-detail" role="status"></p>
        <form id="connect-form" novalidate><label for="connection-url" data-i18n="shell:connectionUrl"></label><div class="connection-url-row"><input id="connection-url" type="password" autocomplete="off" spellcheck="false" placeholder="http://127.0.0.1:4317/#token=…&amp;port=4317"><button id="connection-show" type="button"></button><button id="connection-clear" type="button"></button></div>
          <small data-i18n="shell:connectionWarning"></small>
          <button type="submit" data-i18n="shell:connect"></button></form>
        <button id="handoff-start" type="button" data-i18n="shell:handoff"></button>
        <div id="handoff-panel" hidden><canvas id="handoff-qr" role="img" data-i18n-aria-label="shell:handoffQr"></canvas><p data-i18n="shell:handoffWarning"></p><button id="handoff-hide" type="button" data-i18n="shell:hideQr"></button></div>
        <small data-i18n="shell:saveReminder"></small>
      </section>
    </aside>
  </main>
  <footer><span id="message" role="status" data-i18n="shell:ready"></span></footer>
  <input id="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden>
`;
translateUi(app);
groupToolbar(app.querySelector<HTMLElement>('nav')!);
createSidebar(app,!pagesMode);
const hintToggle=app.querySelector<HTMLButtonElement>('#hint-toggle')!;
const operationHint=app.querySelector<HTMLElement>('#operation-hint')!;
hintToggle.onclick=()=>{
  operationHint.hidden=!operationHint.hidden;
  const show=!operationHint.hidden;
  hintToggle.setAttribute('aria-expanded',String(show));
  hintToggle.textContent=show?'‹':'›';
  hintToggle.setAttribute('data-i18n-title',show?'shell:hideHint':'shell:showHint');
  hintToggle.title=t(show?'shell:hideHint':'shell:showHint');
  hintToggle.setAttribute('data-i18n-aria-label',show?'shell:hideHint':'shell:showHint');
  hintToggle.setAttribute('aria-label',hintToggle.title);
};
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
function updateHeaderLanguage() {
  headerIcon($<HTMLButtonElement>('#undo'), 'undo', t('undo'));
  headerIcon($<HTMLButtonElement>('#redo'), 'redo', t('redo'));
}
updateHeaderLanguage();
document.addEventListener(languageChangeEvent, updateHeaderLanguage);
const canvas = app.querySelector<SVGSVGElement>('#canvas')!;
const deskBackground = createDeskBackground(canvas);
const originGuides=createOriginGuides(canvas,app.querySelector<HTMLElement>('#empty')!);
const viewport = app.querySelector<SVGGElement>('#viewport')!;
const objectsLayer = app.querySelector<SVGGElement>('#objects')!;
const overlays = app.querySelector<SVGGElement>('#overlays')!;
const drawnNodes = new Map<string, SVGGElement>();
let renderedScene: DeskObject[] = [];
const pinSeriesMap = new Map<string, Series>();
let renderedRounding = buildJunctionRounding([]);
const renderedById = new Map<string, DeskObject>();
const form = $<HTMLFormElement>('#properties');
form.querySelectorAll<HTMLButtonElement>('[data-wayfinder-mode]').forEach(button=>button.onclick=()=>{
  const control=form.elements.namedItem('wayfinderMode') as HTMLSelectElement;control.value=button.dataset.wayfinderMode!;control.dispatchEvent(new Event('change',{bubbles:true}));
});
form.querySelectorAll<HTMLButtonElement>('[data-link-display]').forEach(button=>button.onclick=()=>{const control=form.elements.namedItem('linkDisplay') as HTMLSelectElement;control.value=button.dataset.linkDisplay!;control.dispatchEvent(new Event('change',{bubbles:true}));});
$('#prop-head-selection').onclick=()=>{
  const control=form.elements.namedItem('propSelection') as HTMLSelectElement;
  control.value=control.value==='head'?'normal':'head';
  control.dispatchEvent(new Event('change',{bubbles:true}));
};
const propertyEditor = createPropertyEditor(form, desk, (id, patch) => {
  execute([{ kind: 'update', id, patch }]); render(); notify(t('messages:revisionObjects',{revision:desk.revision,count:desk.summary().count}));
}, message => notify(message, true));
addFormNumberPresets(form);
const clipMenuUpdates = ([
  ['rulerMode','shell:layout',{free:'shell:free',gap:'shell:gap',center:'shell:center'}],
  ['rulerMaterial','shell:rulerMaterial',{acrylic:'shell:acrylic',bamboo:'shell:bamboo',steel:'shell:steel'}],
  ['rulerThickness','shell:rulerThickness',{'24':'24','36':'36','48':'48'}],
  ['clipOffsetMode','shell:offsetMode',{'fixed':'shell:fixedOffset','percent':'shell:previousPercent','base-short-side':'shell:firstPercent'}],
  ['clipAutoSize','shell:sizeMode',{'false':'shell:manualSize','true':'shell:autoSize'}],
  ['clipStyle','shell:clipStyle',{binder:'shell:binder',wire:'shell:wire'}],
  ['clipAnchor','shell:clipAnchor',{'top-left':'shell:topLeft',top:'shell:top','top-right':'shell:topRight',right:'shell:right','bottom-right':'shell:bottomRight',bottom:'shell:bottom','bottom-left':'shell:bottomLeft',left:'shell:left'}],
] as const).map(([name,labelKey,labels])=>{
  const input=form.elements.namedItem(name) as HTMLSelectElement;
  const {menu,choices,wrapper}=addPresetPalette(input,Object.keys(labels),t(labelKey),labelKey);input.hidden=true;wrapper.classList.add('line-style-picker');
  for(const button of choices.querySelectorAll<HTMLButtonElement>('button')) {const label=(labels as Record<string,string>)[button.dataset.value!]; if(label.startsWith('shell:')){uiText(button,label as UiKey);uiAttribute(button,'aria-label',label as UiKey);}else{button.textContent=label;button.setAttribute('aria-label',label);}}
  if(name==='clipAnchor'){
    choices.classList.add('clip-anchor-choices');
    const positions:Record<string,[number,number]>={'top-left':[1,1],top:[1,2],'top-right':[1,3],left:[2,1],right:[2,3],'bottom-left':[3,1],bottom:[3,2],'bottom-right':[3,3]};
    const paper=document.createElement('span');paper.className='clip-anchor-paper';paper.setAttribute('aria-hidden','true');choices.append(paper);
    for(const button of choices.querySelectorAll<HTMLButtonElement>('button')){
      const [row,column]=positions[button.dataset.value!];button.style.gridRow=String(row);button.style.gridColumn=String(column);
    }
  }
  return ()=>{const label=(labels as Record<string,string>)[input.value]??'';if(label.startsWith('shell:'))uiText(menu,label as UiKey);else{menu.removeAttribute('data-i18n');menu.textContent=label;}choices.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.setAttribute('aria-pressed',String(input.value===button.dataset.value)));};
});
const updateStrokeWidthMode=createStrokeWidthMode(form.elements.namedItem('fixedWidth') as HTMLInputElement,'authoring:fixedLine');
const updateConnectorLineStyle = createLineStylePicker(form.elements.namedItem('dash') as HTMLSelectElement);
const updateStartMarker = createEndpointPicker(form.elements.namedItem('startMarker') as HTMLSelectElement, t('messages:startMarker'), 'start');
const updateTextFit = createTextFitPicker(form.elements.namedItem('textFit') as HTMLSelectElement);
const updateCallout = createCalloutPicker(form.elements.namedItem('calloutMode') as HTMLSelectElement);
const updateEndMarker = createEndpointPicker(form.elements.namedItem('endMarker') as HTMLSelectElement, t('messages:endMarker'), 'end');
const camera = { x: 60, y: 50, zoom: 1 };
const bhDeletion = new BhDeletion();
const humanScroll = new HumanScrollGuard();
const cameraAnimator = new CameraAnimator();
const wayfinderTravel=new WayfinderTravel();
const wayfinderMap=createWayfinderMap(canvas);
const pinNavigation=createPinNavigation(canvas,startPinTravel);
const wayfinderNavigation=createWayfinderNavigation(canvas,startWayfinder);
let navigation:undefined|{runId:number;status:'moving'|'waiting'|'completed'|'cancelled'|'failed';mode:'move'|'tour';reason?:string;message?:string;point?:{x:number;y:number};choices?:{lineId:string;from:'start'|'end'}[];id?:string;lineId?:string;from?:'start'|'end';pinId?:string};
const cancelWayfinding=(reason:WayfinderStopReason='human')=>{wayfinderTravel.cancel(reason);wayfinderMap.cancel(reason);};
const wayfinderMarker=svg('g',{'pointer-events':'none','aria-hidden':'true','data-wayfinder-marker':''});viewport.append(wayfinderMarker);
const objectAnimator = new ObjectMoveAnimator();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const stopCamera = (event?:Event) => {
  if(event&&wayfinderMap.contains(event.target))return;
  const escapeTravel=event instanceof KeyboardEvent&&event.key==='Escape'&&(navigation?.status==='moving'||navigation?.status==='waiting');
  cancelWayfinding(document.hidden?'hidden':'human');cameraAnimator.cancel('Human interaction or viewport change');objectAnimator.finish();
  // Escape stops a journey once; do not then clear selection and overwrite the stop notice.
  if(escapeTravel)event!.stopPropagation();
};
for (const event of ['pointerdown', 'touchstart', 'keydown', 'click', 'input']) {
  document.addEventListener(event, stopCamera, { capture: true, passive: true });
}
window.addEventListener('resize', stopCamera);
new ResizeObserver(()=>stopCamera()).observe(canvas);
document.addEventListener('visibilitychange', stopCamera);
window.addEventListener('pagehide', stopCamera);
reducedMotion.addEventListener('change', stopCamera);
// Capture before canvas zoom handlers; never cancel or delay the human input itself.
app.addEventListener('wheel', () => { stopCamera(); humanScroll.record(); }, { capture: true, passive: true });
document.addEventListener('scroll', () => { stopCamera(); humanScroll.record(); }, { capture: true, passive: true });
const cameraSize = () => ({ width: canvas.clientWidth, height: canvas.clientHeight });
function animateCamera(target: typeof camera, options: AnimationOptions) {
  cancelWayfinding('superseded');
  if (document.hidden) throw new Error('Camera action cancelled: desk is hidden; do not retry automatically.');
  return cameraAnimator.run({ ...camera }, target, cameraSize(), next => {
    Object.assign(camera, next);
    cameraChanged(); drawSelection();
  }, reducedMotion.matches ? { durationMs: 0 } : options);
}
const cameraControls = {
  wayfinderStart:(input:WayfinderStartInput)=>beginWayfinder(input),
  get: () => ({...cameraView(camera,cameraSize()),...(navigation?{navigation:structuredClone(navigation)}:{})}),
  async move(input: CameraMove) {
    const next = movedCamera(camera, cameraSize(), input);
    await animateCamera(next.camera, input);
    return { ...cameraView(camera, cameraSize()), ...(navigation?{navigation:structuredClone(navigation)}:{}),zoomClamped: next.zoomClamped };
  },
};
let space = false;

let busy = false;
let pinVisibility: PinVisibility = 'all';
let gridEnabled = true;
function gridPosition(point: { x: number; y: number }) {
  const grid = desk.settingsSnapshot().grid;
  return grid.enabled ? gridPoint(point, grid) : point;
}
let gesture: Gesture | null = null;
const colorControls = createColorControls($('#color-controls'), operations => {
  if (busy || !operations.length) return;
  attempt(() => execute(operations));
});
const editor = createInlineEditor($('#workspace'), viewport, (object, patch, fresh) => {
  execute([fresh ? { kind: 'add', object: { ...object, ...patch } } : { kind: 'update', id: object.id, patch }], fresh ? 'desk' : 'exact');
  if (fresh) desk.select([object.id]);
  render();
}, () => drawSelection(), target => target instanceof Element && !!target.closest('#desk-menu, #desk-menu-panel'));
const authoring = createAuthoring(desk, $('#authoring-tools'), $('#series-panel'), $<HTMLButtonElement>('#numbering'), $<HTMLButtonElement>('#selection-mode'), (operations, selectId) => {
  if (!busy && !editor.isActive()) attempt(() => { execute(operations, selectId ? 'desk' : 'exact'); if (selectId) desk.select([selectId]); });
}, newPartPoint,notify);
const formatControls = createFormatControls(desk, $('#authoring-tools'), operations => {
  if (busy || editor.isActive()) throw new Error(t('messages:finishFormat'));
  execute(operations); render();
}, notify);
const editActions = document.createElement('div'); editActions.className = 'toolbar-edit-actions';
editActions.setAttribute('role', 'group'); uiAttribute(editActions,'aria-label','messages:editGroup');
for (const [id, icon, label] of [['front', '▣↑', t('messages:front')], ['back', '▣↓', t('messages:back')]]) {
  const button = $<HTMLButtonElement>(`#${id}`); iconButton(button, icon, label); editActions.append(button);
}
const animatedDeleteButton=document.createElement('button');animatedDeleteButton.id='delete-animated';animatedDeleteButton.type='button';
iconButton(animatedDeleteButton,'×',t('messages:animatedDelete'));
animatedDeleteButton.onclick=()=>animateDelete(DELETE_MODES[Math.floor(Math.random()*DELETE_MODES.length)]);
editActions.append(animatedDeleteButton);
editActions.append($('#reaction-controls'), $('#grid-snap')); $('.toolbar-parts').append(editActions);
const lockControls = createLockControls($('#grid-snap'), form, () => {
  if (busy || editor.isActive() || !desk.selected().length) return;
  attempt(() => {
    const scene = desk.snapshot();
    const objects = [...new Set(desk.selected().flatMap(id => fileGroup(scene,id).map(object => object.id)))].map(id => desk.get(id));
    const operations = lockOperations(objects, lockSelectionState(objects).nextLocked);
    if (operations.length) execute(operations);
  });
});
const captureCamera=createCaptureCamera(desk,canvas,camera,()=>{cameraChanged();drawSelection();},id=>pinDescriptionVisible(desk.get(id)),notify);
const captureButton=document.createElement('button');captureButton.id='camera-capture';captureButton.type='button';iconButton(captureButton,'▣',t('messages:camera'));$('#mouse-lock').after(captureButton);
captureButton.onclick=()=>{if(busy||gesture||editor.isActive()||identityControls.isEditing()||doodleEditor.isActive()||lineInput.isActive()||isConfirmDialogOpen())return;stopCamera();captureCamera.open();};
$('#numbering-settings').after($('#label-descriptions'));
$('main').append($('.toolbar-view'));
const activityLed = createActivityLed($('footer'));
const centerViewButton=document.createElement('button');centerViewButton.id='view-center';centerViewButton.type='button';
iconButton(centerViewButton,'',t('messages:originCenter'));$('#fit').after(centerViewButton);
centerViewButton.onclick=()=>{void cameraControls.move({center:{x:0,y:0}}).catch(error=>{
  if(!(error instanceof Error&&error.message.startsWith('Camera animation cancelled:')))notify(uiErrorMessage(error),true);
});};
const bellControls=createBellControls(centerViewButton,$('footer'),note=>recovery.ringBell(desk.selected(),note),notify);
const reactionControls = createReactionControls($('#reaction-controls'), () => desk.selected().map(id => desk.get(id)), operations => {
  if(!busy&&!gesture&&!editor.isActive()&&operations.length)try{execute(operations);renderDecorations(operations.map(op=>'id' in op?op.id:''));notify(t('badges:updated'));}catch(error){notify(uiErrorMessage(error),true);}
});
const reactionSizeControls=createReactionSizeControls(form,()=>desk.selected().map(id=>desk.get(id)),operations=>{if(!busy&&!editor.isActive())attempt(()=>execute(operations));},notify);
const stampContainer = document.createElement('div'); stampContainer.id = 'stamp-controls'; editActions.insertBefore(stampContainer, $('#reaction-controls'));
let stampPressIds=new Set<string>(),stampPressGeneration='',stampPressTimer:ReturnType<typeof setTimeout>|undefined,stampPressSerial=0;
const compactStamp=(id:string)=>desk.selected().includes(id)&&!(stampPressGeneration===desk.documentGeneration&&stampPressIds.has(id));
const stampControls = createStampControls(stampContainer, () => desk.selected().map(id => desk.get(id)), operations => {
  if(busy||gesture||editor.isActive()||!operations.length)return false;
  try{
    execute(operations);
    const previousPressIds=[...stampPressIds];
    clearTimeout(stampPressTimer);stampPressIds=new Set(operations.flatMap(op=>op.kind==='update'&&op.patch.stamp?[op.id]:[]));stampPressGeneration=desk.documentGeneration;
    const serial=++stampPressSerial,ids=[...stampPressIds],generation=stampPressGeneration;
    renderDecorations([...previousPressIds,...operations.map(op=>'id' in op?op.id:'')]);
    if(ids.length)requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(serial!==stampPressSerial||generation!==desk.documentGeneration)return;
      stampPressTimer=setTimeout(()=>{stampPressIds.clear();if(!gesture&&generation===desk.documentGeneration)renderDecorations(ids);},1600);
    }));
    notify(t('messages:stampUpdated'));return true;
  }catch(error){notify(uiErrorMessage(error),true);return false;}
});
const propContainer = document.createElement('div'); propContainer.id = 'prop-controls'; $('#reaction-controls').after(propContainer);
createPropControls(propContainer, (preset, src) => {
  if (busy || editor.isActive()) throw new Error(t('messages:finishProp'));
  attempt(() => newObject('prop', { src, text: preset.name, width: preset.width, height: preset.height }));
}, notify);
$('#clipboard').before(stampContainer, $('#reaction-controls'), propContainer);
const formatGroup=document.createElement('div');formatGroup.className='toolbar-format-group';formatGroup.setAttribute('role','group');uiAttribute(formatGroup,'aria-label','messages:formatGroup');
const deskOptions=document.createElement('div');deskOptions.className='toolbar-options-group';deskOptions.setAttribute('role','group');uiAttribute(deskOptions,'aria-label','messages:deskOptions');
deskOptions.append($('#numbering-settings'),$('#label-descriptions'),$('#grid-snap'),$('#mouse-lock'),captureButton);
formatGroup.append(...$('#authoring-tools').children);
editActions.prepend($('#clipboard'));uiAttribute(editActions,'aria-label','messages:editActions');
$('#authoring-tools').append(formatGroup,editActions,deskOptions);
const wayfinderCreate=document.createElement('button');wayfinderCreate.id='wayfinder-create';wayfinderCreate.type='button';iconButton(wayfinderCreate,'',t('messages:wayfinder'));
$('#pin-series-menu').after(wayfinderCreate);
wayfinderCreate.onclick=()=>{if(!busy&&!editor.isActive())attempt(()=>newObject('wayfinder',{fill:'#dcfce7',fillOpacity:1,stroke:'#166534',text:t('creation:wayfinder')}));};
const clipCreate=document.createElement('button');clipCreate.id='clip-create';iconButton(clipCreate, '', t('messages:clip'));uiAttribute(clipCreate,'title','messages:clipHint');
clipCreate.onclick=()=>{if(!busy&&!editor.isActive())attempt(()=>{
  const operations=bundleOperations(desk.snapshot(),desk.selected());
  if(operations.length){execute(operations);const last=operations[0];if(last.kind==='add')desk.select([last.object.id]);}
  else if(!desk.selected().length)newObject('clip',{clipMembers:[],clipSize:64,clipAutoSize:true,clipOffset:32,clipStyle:'binder',fill:'#26313d'});
});};
app.querySelector('[data-add="text"]')!.after(clipCreate);
const fileCreate=document.createElement('button');fileCreate.id='file-create';iconButton(fileCreate,'',t('messages:clearFolder'));uiAttribute(fileCreate,'title','messages:fileHint');
fileCreate.onclick=()=>{if(!busy&&!editor.isActive())attempt(()=>{const operations=fileCreateOperations(desk.snapshot(),desk.selected(),desk.settingsSnapshot().grid,t('messages:clearFolder'));execute(operations);const add=operations.find(op=>op.kind==='add');if(add?.kind==='add')desk.select([add.object.id]);});};clipCreate.after(fileCreate);
const rulerCreate=document.createElement('button');rulerCreate.id='ruler-create';iconButton(rulerCreate,'',t('messages:ruler'));uiAttribute(rulerCreate,'title','messages:rulerHint');
rulerCreate.onclick=()=>{if(!busy&&!editor.isActive())attempt(()=>{const operations=rulerCreateOperations(desk.snapshot(),desk.selected(),newPartPoint(),t('messages:ruler'));execute(operations,'exact');const op=operations[0];if(op.kind==='add')desk.select([op.object.id]);});};fileCreate.after(rulerCreate);
const thinkingMode = createThinkingMode($('header'), () => { objectAnimator.finish(); cameraAnimator.cancel('Human-only thinking mode'); desk.point([]); drawSelection(); }, notify);
const identityControls = createDeskIdentityControls($('header'), desk,
  () => !busy && !gesture && !editor.isActive(), () => render(false), notify);
const deskFiles=createDeskFileControls($('header'), desk, () => { bhDeletion.stop();objectAnimator.finish();cancelWayfinding('changed');cameraAnimator.cancel('Desk contents replaced');partClipboard.clear(); render(); fitView(desk.selected()); },
  () => !busy && !gesture && !editor.isActive() && !identityControls.isEditing(),
  () => {objectAnimator.finish();return deskPdf(desk,canvas,id=>pinDescriptionVisible(desk.get(id)));},
  request=>pagesMode?pagesFileRequest(request,desk.filePath??document.baseURI):recovery.fileRequest(request),
  (path,name)=>newObject('link',{deskPath:path,text:name,width:360,height:72}),pagesMode,
  () => {objectAnimator.finish();return deskPng(desk,canvas,id=>pinDescriptionVisible(desk.get(id)));});
createUiThemeButton($('header'));
const deskMenu = createDeskMenu($('header'), desk, patch => {
  if (busy || gesture || editor.isActive()) { notify(t('messages:finishSettings'), true); deskMenu.refresh(); return; }
  attempt(() => execute([{ kind: 'background_update', patch }]));
}, preview => {
  const background = desk.settingsSnapshot().background;
  deskBackground.update({ ...background, ...preview }, camera);
}, () => {
  if (busy || gesture || editor.isActive()) { notify(t('messages:finishExperiment'), true); return; }
  void rasterPointedCard(desk, id => drawnNodes.get(id)).then(raster => openBhPreview(raster.dataUrl))
    .catch(error => notify(uiErrorMessage(error), true));
}, patch=>{
  if (busy || gesture || editor.isActive()) { notify(t('messages:finishSettings'), true); deskMenu.refresh(); return; }
  attempt(()=>execute([{kind:'grid_update',patch}]));
}, () => !busy && !gesture && !editor.isActive() && !identityControls.isEditing()
  && !lineInput.isActive() && !doodleEditor.isActive() && !captureCamera.isActive() && !isConfirmDialogOpen());
function objectListIncludes(object: DeskObject) {
  if ($('#object-filter-apply').getAttribute('aria-checked') !== 'true') return true;
  if ($('#object-filter-files').getAttribute('aria-pressed')==='true'&&fileFor(renderedScene,object.id))return true;
  if ($('#object-filter-clips').getAttribute('aria-pressed')==='true' && clipFor(renderedScene,object.id)) return true;
  const category = object.type==='file'?'files':object.type === 'clip' ? 'clips' : object.type === 'label' ? 'pins' : object.type === 'text' ? 'text'
    : isShapeType(object.type) ? 'shapes'
      : object.type === 'line' ? 'lines'
        : ['image', 'svg', 'mermaid', 'qrcode', 'prop'].includes(object.type) ? 'images' : 'other';
  return $(`#object-filter-${category}`).getAttribute('aria-pressed') === 'true';
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
function notify(message: string, error = false) { $('#message').removeAttribute('data-i18n'); $('#message').textContent = message; $('#message').classList.toggle('error', error); }
function attempt(action: () => void) {
  try { action(); render(); notify(t('messages:revisionObjects',{revision:desk.revision,count:desk.summary().count})); }
  catch (error) { notify(uiErrorMessage(error), true); }
}
function execute(operations: Operation[], snap: 'desk' | 'exact' = 'exact') { desk.execute({ actor: 'human', operations, snap }); }
function screen(event: PointerEvent | WheelEvent) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function world(event: PointerEvent | WheelEvent) {
  const p = screen(event);
  return { x: (p.x - camera.x) / camera.zoom, y: (p.y - camera.y) / camera.zoom };
}
function cameraChanged() {
  const settings = desk.settingsSnapshot();
  deskBackground.update(settings.background, camera);
  originGuides.update(settings.background,camera);
  applyTitleBackground($('header'),settings.background.titleBackground);
  viewport.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.zoom})`);
  const grid = settings.grid, dots = app.querySelector('#dots')!;
  dots.setAttribute('width', String(grid.interval)); dots.setAttribute('height', String(grid.interval));
  dots.setAttribute('x', String(grid.origin.x - grid.interval / 2)); dots.setAttribute('y', String(grid.origin.y - grid.interval / 2));
  dots.querySelector('circle')!.setAttribute('cx', String(grid.interval / 2));
  dots.querySelector('circle')!.setAttribute('cy', String(grid.interval / 2));
  const gridLines=settings.background.gridStyle==='lines',gridColor=settings.background.gridColor??'#cbd5e1';
  dots.querySelector('circle')!.setAttribute('fill',gridColor);dots.querySelector('circle')!.setAttribute('display',gridLines?'none':'inline');
  const gridPath=dots.querySelector('path')!;gridPath.setAttribute('d',`M ${grid.interval/2} 0 V ${grid.interval} M 0 ${grid.interval/2} H ${grid.interval}`);gridPath.setAttribute('stroke',gridColor);gridPath.setAttribute('display',settings.background.gridStyle!=='dots'&&settings.background.gridStyle!==undefined?'inline':'none');
  dots.setAttribute('patternTransform', `translate(${camera.x} ${camera.y}) scale(${camera.zoom})`);
  $('#zoom-reset .tool-icon').textContent = `${Math.round(camera.zoom * 100)}%`;
  refreshPinPresentation();
  editor.reposition();
  deskOverview.cameraChanged();
}
function zoom(factor: number, center = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }) {
  const old = camera.zoom;
  camera.zoom = Math.max(0.05, Math.min(8, old * factor));
  camera.x = center.x - (center.x - camera.x) * camera.zoom / old;
  camera.y = center.y - (center.y - camera.y) * camera.zoom / old;
  cameraChanged(); drawSelection();
}
function pinMode(object: DeskObject): PinVisibility {
  if (object.type !== 'label') return 'all';
  const series = pinSeriesMap.get(object.seriesId!);
  return effectivePinVisibility(pinVisibility, series?.visibility ?? 'all');
}
function pinIsVisible(object: DeskObject) { return pinMode(object) !== 'hidden'; }
function pinDescriptionVisible(object: DeskObject) { return pinMode(object) === 'all'; }
function connectorForView(object: DeskObject): DeskObject {
  if (!isConnector(object)) {
    const binding = object.callout?.binding, target = binding && renderedById.get(binding.objectId);
    return target?.type === 'label' ? { ...object, callout: { ...object.callout!, ...anchorPoint(pinScreenObject(target, camera.zoom), binding!.anchor) } } : object;
  }
  const points = endpoints(object);
  for (const side of ['start', 'end'] as const) {
    const binding = object[side === 'start' ? 'startBinding' : 'endBinding'];
    const target = binding && renderedById.get(binding.objectId);
    if (target?.type === 'label') points[side] = anchorPoint(pinScreenObject(target, camera.zoom), binding!.anchor);
  }
  return { ...object, x: points.start.x, y: points.start.y, x2: points.end.x, y2: points.end.y };
}
function refreshPinPresentation() {
  renderedRounding = buildJunctionRounding(renderedScene.map(connectorForView));
  for (const object of renderedScene) {
    const node = drawnNodes.get(object.id);
    if (!node) continue;
    if (object.callout?.binding && renderedById.get(object.callout.binding.objectId)?.type === 'label') {
      const path = node.querySelector('.text-callout');
      const visual = connectorForView(object);
      path?.setAttribute('d', calloutPath(visual)); drawCalloutLeader(node, visual);
    }
    if (object.type === 'label') node.setAttribute('transform', pinTransform(object, camera.zoom));
    else if (isConnector(object)) {
      const visual = connectorForView(object);
      node.setAttribute('transform', `translate(${visual.x} ${visual.y})`);
      node.replaceChildren(); drawConnector(node, visual, camera.zoom, renderedRounding.get(object.id));
    }
    drawReactions(node, connectorForView(object), pinDescriptionVisible(object), camera.zoom);
    updateQrCardLayout(node,object,camera.zoom);
    drawStickers(node, object, camera.zoom);
  }
}
function drawPinThreads(scene: DeskObject[]) {
  objectsLayer.querySelectorAll('[data-pin-thread]').forEach(node => node.remove());
  for (const series of pinSeriesMap.values()) {
    const thread = series.thread;
    if (!thread.enabled || !thread.visible || effectivePinVisibility(pinVisibility, series.visibility) === 'hidden') continue;
    const pins = pinThreadMembers(scene, series);
    if (pins.length < 2) continue;
    const first = scene.find(object => object.type === 'label' && object.seriesId === series.id);
    const before = first && drawnNodes.get(first.id);
    if (!before) continue;
    const points = pins.map(object => `${object.x + object.width / 2},${object.y + object.height}`).join(' ');
    const path = svg('polyline', { points, fill: 'none', stroke: thread.color, 'stroke-width': thread.width,
      'stroke-opacity': thread.opacity, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      ...(thread.fixedWidth?{'vector-effect':'non-scaling-stroke'}:{}), 'pointer-events': 'none', 'data-pin-thread': series.id });
    if (thread.dash !== 'solid') path.setAttribute('stroke-dasharray', thread.dash === 'dashed'
      ? `${thread.width * 4} ${thread.width * 3}` : `${thread.width} ${thread.width * 2}`);
    objectsLayer.insertBefore(path, before);
  }
}
function drawObject(object: DeskObject) {
  if(!object.cutout){drawObjectRaw(object);return;}
  const group=svg('g',{transform:`translate(${object.x} ${object.y})`,'data-id':object.id,'data-locked':String(!!object.locked)});
  drawCutout(group,object,source=>{drawObjectRaw(source);return objectsLayer.lastElementChild as SVGGElement;});
  if(object.type!=='text')drawOpenLink(group,object);
  drawReactions(group,object,pinDescriptionVisible(object),camera.zoom);
  drawStickers(group,object,camera.zoom);
  drawnNodes.set(object.id,group);objectsLayer.append(group);
}
function drawObjectRaw(object: DeskObject) {
  if (!pinIsVisible(object)) return;
  object = connectorForView(object);
  const { width: w, height: h } = object;
  const group = svg('g', { transform: object.type === 'label' ? pinTransform(object, camera.zoom) : `translate(${object.x} ${object.y})`,
    'data-id': object.id, 'data-locked': String(!!object.locked), ...(headSelectedProp(object)?{'pointer-events':'none'}:{}) });
  drawnNodes.set(object.id, group);
  if (isConnector(object)) {
    drawConnector(group, object, camera.zoom, renderedRounding.get(object.id)); drawReactions(group, object, pinDescriptionVisible(object), camera.zoom);
    objectsLayer.append(group); return;
  }
  const style = { fill: object.fill, 'fill-opacity': object.fillOpacity, stroke: object.stroke, 'stroke-width': object.strokeWidth };
  const shape = object.type === 'label' ? object.labelShape : object.type;
  if (shape === 'rect' || shape === 'roundedRect') group.append(svg('rect', { width: w, height: h,
    rx: shape === 'roundedRect' ? Math.min(object.cornerRadius, w / 2, h / 2) : 0, ...style }));
  if (shape === 'ellipse') group.append(svg('ellipse', { cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2, ...style }));
  if (shape === 'pin') group.append(svg('path', { d: pinPath(w, h), ...style, 'stroke-linejoin': 'round', class: 'pin-frame' }));
  if (object.type === 'label' && shape === 'text') {
    group.append(svg('rect', { width: w, height: h, fill: 'transparent' }));
    const text = svg('text', { x: w / 2, y: h / 2, fill: object.textColor, 'font-size': object.fontSize,
      'text-anchor': 'middle', 'dominant-baseline': 'middle', 'pointer-events': 'none' });
    text.textContent = object.text; group.append(text);
  }
  const extraShape = shapePaths(object.type, w, h);
  if (extraShape) {
    group.append(svg('path', { d: extraShape.outline, ...style, class: 'diagram-shape', 'stroke-linejoin': 'round' }));
    if ('detail' in extraShape && extraShape.detail) group.append(svg('path', { d: extraShape.detail, fill: 'none', stroke: object.stroke, 'stroke-width': object.strokeWidth, 'pointer-events': 'none' }));
  }
  drawShapeText(group, object);
  drawLabelDescription(group, object, pinDescriptionVisible(object));
  if (object.type === 'text') {
    group.append(object.callout
      ? svg('path', { d: calloutPath(object), ...style, class: 'text-callout' })
      : svg('rect', { width: w, height: h, rx: Math.min(object.cornerRadius, w / 2, h / 2), ...style }));
    if (object.callout) drawCalloutLeader(group, object);
    drawMarkdown(group, object);
    drawStamp(group, object, compactStamp(object.id));
  }
  if (['link', 'web', 'image', 'svg', 'mermaid', 'qrcode', 'prop'].includes(object.type)) {
    if (object.type === 'prop') {
      // Head mode leaves the artwork transparent to pointer hit testing.
      group.append(svg('rect', { width: w, height: headSelectedProp(object)?Math.min(IMAGE_TITLE_HEIGHT,h):h, fill: 'transparent', stroke: 'none', 'pointer-events': 'all', 'data-prop-body': '' }));
      group.append(svg('rect', { width: w, height: Math.min(IMAGE_TITLE_HEIGHT, h), rx: 6, fill: '#ffffff', stroke: '#94a3b8', 'data-prop-title': '' }));
    } else if(object.doodle){
      group.append(svg('rect',{width:w,height:h,rx:6,fill:'transparent',stroke:'#94a3b8','data-doodle-frame':''}),svg('rect',{width:w,height:Math.min(h,IMAGE_TITLE_HEIGHT),fill:'#ffffff','data-doodle-title':''}));
    } else group.append(svg('rect', { width: w, height: h, rx:isUrlLink(object)&&object.linkDisplay!=='qr'?Math.min(object.cornerRadius,w/2,h/2):6, ...(isUrlLink(object)&&object.linkDisplay!=='qr'?style:{fill:'#ffffff',stroke:'#94a3b8'}) }));
    if(object.deskPath)drawDeskLinkIcon(group,object);
    const title = svg('text', { x: object.deskPath?42:isUrlLink(object)?36:12, y: 23, 'font-size': 14, fill: '#1d4ed8' });
    title.textContent = (object.text || object.deskPath || object.url || '').slice(0, Math.max(0, Math.floor((w - (object.deskPath?82:isUrlLink(object)?76:52)) / 8))); group.append(title);
    if (['image', 'svg', 'prop'].includes(object.type) && h > IMAGE_TITLE_HEIGHT) {
      // SVG stays in an image context, never inserted as executable markup.
      group.append(svg('image', { y: IMAGE_TITLE_HEIGHT, width: w, height: h - IMAGE_TITLE_HEIGHT, href: object.doodle?doodleSource(object.doodle,w,Math.max(1,h-IMAGE_TITLE_HEIGHT)):object.src!, preserveAspectRatio: 'xMidYMid meet' }));
    }
    if (object.type === 'web' && h > 40) {
      const foreign = svg('foreignObject', { x: 0, y: 34, width: w, height: h - 34 });
      const iframe = document.createElement('iframe');
      iframe.src = object.url!; if(object.text)iframe.title=object.text;else uiAttribute(iframe,'title','messages:webPage');
      iframe.setAttribute('sandbox', 'allow-scripts'); iframe.referrerPolicy = 'no-referrer';
      iframe.loading = 'lazy'; iframe.style.pointerEvents = 'none';
      foreign.append(iframe); group.append(foreign);
    }
    if (object.type === 'mermaid') drawMermaidCard(group, object);
    if(object.type==='qrcode')drawQrCard(group,object,camera.zoom);
    if(isUrlLink(object))drawLinkDisplay(group,object,camera.zoom);
    drawOpenLink(group, object, path=>{void deskFiles.open(path);});
  }
  if(object.type==='wayfinder')drawWayfinder(group,object,renderedScene);
  if(object.type==='file'){drawClearFile(group,object);drawStamp(group,object,compactStamp(object.id));}
  if(object.type==='ruler')drawRuler(group,object);
  if(object.type==='clip') drawClip(group,object,renderedById.get(object.clipMembers?.[0] ?? ''));
  drawReactions(group, object, pinDescriptionVisible(object), camera.zoom);
  drawStickers(group, object, camera.zoom);
  objectsLayer.append(group);
}
function drawSelection(preview?: DeskObject[], scene = preview, refreshStamps=true) {
  for (const object of refreshStamps ? scene ?? renderedScene : []) {
    const node = drawnNodes.get(object.id);
    if (node && ['text','file'].includes(object.type) && (object.stamp || node.querySelector('[data-stamp]'))) {
      const source=object.cutout?node.querySelector<SVGGElement>('[data-cutout-source]'):node;
      if(source)drawStamp(source,object.cutout?cutoutSourceObject(object):object,compactStamp(object.id));
    }
  }
  const colors = frameColors(desk.settingsSnapshot().background);
  $<HTMLButtonElement>('#clear-ai-pointing').disabled = desk.pointed().length === 0;
  const fit = $('#fit'), hasSelection = desk.selected().length > 0, hasPointing = desk.pointed().length > 0;
  const fitTitle = hasSelection ? 'shell:fitSelectionTitle' : hasPointing ? 'shell:fitPointingTitle' : 'shell:fitAll';
  uiAttribute(fit, 'title', fitTitle); uiAttribute(fit, 'aria-label', fitTitle);
  uiText(fit.querySelector('.tool-caption')!, hasSelection ? 'shell:fitSelection' : hasPointing ? 'shell:fitPointing' : 'shell:fitAllCaption');
  overlays.replaceChildren();
  const selected = preview ?? desk.selected().map(id => desk.get(id));
  const pin=selected.length===1&&selected[0].type==='label'&&pinIsVisible(selected[0])?selected[0]:undefined;
  const series=pin&&pinSeriesMap.get(pin.seriesId!);
  pinNavigation.update(editor.isActive()?undefined:pin,series?pinNeighbours(scene??renderedScene,series,pin!.id):undefined,camera,navigation?.status==='moving'||navigation?.status==='waiting');
  wayfinderNavigation.update(selected.length===1&&selected[0].type==='wayfinder'?selected[0]:undefined,scene??renderedScene,camera,navigation?.status==='moving'||navigation?.status==='waiting');
  drawClipMembershipGuides(overlays, scene ?? renderedScene, selected.map(object => object.id), camera.zoom, colors.selection);
  for (const object of desk.pointed().map(id => scene?.find(object => object.id === id) ?? desk.get(id)).filter(pinIsVisible))
    drawAiPointing(overlays, [connectorForView(object)], camera.zoom, pinDescriptionVisible(object), colors.pointing);
  for (const source of selected.filter(pinIsVisible)) {
    const object = connectorForView(source);
    const selectionObject=headSelectedProp(object)?{...object,...propSelectionBounds(object)}:object;
    const filed=fileFor(scene??renderedScene,object.id);
    if (object.locked && !filed) { drawLockedSelection(overlays, selectionObject, camera.zoom, pinDescriptionVisible(object), colors.selection); continue; }
    if (!filed && drawEndpointHandles(overlays, object, camera.zoom, selected.length === 1, colors.selection)) continue;
    const visual = labelVisualBounds(selectionObject, pinDescriptionVisible(object), camera.zoom);
    overlays.append(svg('rect', { x: visual.x - 3 / camera.zoom, y: visual.y - 3 / camera.zoom,
      width: visual.width + 6 / camera.zoom, height: visual.height + 6 / camera.zoom,
      fill: 'none', stroke: colors.selection, 'stroke-width': 1.5 / camera.zoom, 'stroke-dasharray': `${5 / camera.zoom} ${3 / camera.zoom}`, 'pointer-events': 'none', 'data-human-selection': object.id }));
    if (selected.length === 1 && !filed && object.callout) overlays.append(svg('circle', {
      cx: object.callout.x, cy: object.callout.y, r: 6 / camera.zoom,
      fill: object.callout.binding ? '#16a34a' : colors.selection, stroke: '#fff', 'stroke-width': 1.5 / camera.zoom,
      'data-callout-tip': object.id, class: 'endpoint-handle',
    }));
    if (selected.length === 1 && !filed && object.type !== 'label' && object.type !== 'clip' && !headSelectedProp(object)) overlays.append(svg('rect', {
      x: object.x + object.width - 5 / camera.zoom, y: object.y + object.height - 5 / camera.zoom,
      width: 10 / camera.zoom, height: 10 / camera.zoom, fill: colors.selection, stroke: '#fff',
      'stroke-width': 1 / camera.zoom, 'data-resize': object.id, class: 'resize-handle',
    }));
  }
}
let previousObjectListSelection = '';
let pendingObjectListSelection = false;
function drawMoveFrame(scene: DeskObject[], resizeMedia=false) {
  const previous = renderedScene;
  const hadRounding = renderedRounding.size > 0;
  renderedScene = scene;
  renderedById.clear(); for (const object of scene) renderedById.set(object.id, object);
  renderedRounding = buildJunctionRounding(scene.map(connectorForView));
  updateScenePreview(objectsLayer, scene, previous, drawObject, hadRounding || renderedRounding.size > 0,resizeMedia);
  refreshPinPresentation(); drawPinThreads(scene);
  drawSelection(scene.filter(object => desk.selected().includes(object.id)), scene,!resizeMedia);
}
/** Decoration edits preserve every card body and unrelated rendered object. */
function renderDecorations(ids:string[]){
  const updates=new Map<string,DeskObject>();
  for(const id of new Set(ids)){
    if(!id||!renderedById.has(id))continue;
    const object=desk.get(id),node=drawnNodes.get(id);updates.set(id,object);renderedById.set(id,object);
    if(!node)continue;
    const source=object.cutout?node.querySelector<SVGGElement>('[data-cutout-source]'):node;
    if(source)drawStamp(source,object.cutout?cutoutSourceObject(object):object,compactStamp(id));
    drawReactions(node,object,pinDescriptionVisible(object),camera.zoom);drawStickers(node,object,camera.zoom);
  }
  renderedScene=renderedScene.map(object=>updates.get(object.id)??object);
  $('#revision').textContent=`rev. ${desk.revision}`;
  $<HTMLButtonElement>('#undo').disabled=!desk.summary().canUndo;$<HTMLButtonElement>('#redo').disabled=!desk.summary().canRedo;
  const selected=desk.selected().map(id=>desk.get(id));
  reactionControls.update(selected);stampControls.update(selected);stickerControls.update();
  refreshHistory();
}
function render(rebuild = true) {
  pinSeriesMap.clear();
  for (const series of desk.settingsSnapshot().series) pinSeriesMap.set(series.id, series);
  identityControls.refresh();
  deskMenu.refresh();
  if (rebuild) {
    objectsLayer.replaceChildren(); drawnNodes.clear();
    const objects = desk.snapshot(); renderedScene = objects;
    renderedById.clear(); for (const object of objects) renderedById.set(object.id, object);
    renderedRounding = buildJunctionRounding(objects.map(connectorForView));
    desk.imageGeometry.observe(objects);
    objects.forEach(drawObject);
    drawPinThreads(objects);
  }
  deskOverview.setObjects(renderedScene.filter(pinIsVisible));
  gridEnabled = desk.settingsSnapshot().grid.enabled;
  $('#grid-snap').setAttribute('aria-pressed', String(gridEnabled));
  $('#empty').hidden = desk.summary().count > 0;
  cameraChanged(); drawSelection();
  $('#revision').textContent = `rev. ${desk.revision}`;
  $<HTMLButtonElement>('#undo').disabled = !desk.summary().canUndo;
  $<HTMLButtonElement>('#redo').disabled = !desk.summary().canRedo;
  const ids = desk.selected();
  colorControls.update(ids.map(id => desk.get(id)));
  reactionControls.update(ids.map(id => desk.get(id)));
  reactionSizeControls.update();
  stampControls.update(ids.map(id => desk.get(id)));
  authoring.update();
  formatControls.update();
  $('#selected-label').removeAttribute('data-i18n');
  $('#selected-label').textContent = ids.length ? t('shell:selected', { count: ids.length, ids: ids.join(', ') }) : t('shell:nothingSelected');
  form.hidden = ids.length !== 1;
  $<HTMLButtonElement>('#card-fit-text').hidden = true;
  if (ids.length !== 1) propertyEditor.clear();
  // Human measurement UI is paused; the read-only MCP tool remains available.
  $<HTMLButtonElement>('#text-measure').hidden = true;
  $('#text-measure-result').textContent = '';
  const link = $<HTMLAnchorElement>('#open-url'); link.hidden = true;
  if (ids.length === 1) {
    const object = desk.get(ids[0]);
    propertyEditor.sync(object);
    if(fileFor(renderedScene,object.id))for(const name of ['width','height',...(object.type==='file'?[]:['rulerMode','rulerMaterial','rulerThickness','x','y','x2','y2','calloutMode','clipOffset','clipOffsetMode','clipOffsetPercent','clipAnchor','clipSize','clipAutoSize','clipStyle'])]){const control=form.elements.namedItem(name) as HTMLInputElement|null;if(control)control.disabled=true;}
    const fitText=$<HTMLButtonElement>('#card-fit-text');
    fitText.hidden=object.type!=='text';
    fitText.disabled=object.type!=='text'||!!object.cutout||(form.elements.namedItem('height') as HTMLInputElement).disabled;
    clipMenuUpdates.forEach(update=>update());
    updateConnectorLineStyle();updateStrokeWidthMode();
    updateStartMarker(); updateEndMarker(); updateCallout(); updateTextFit();
    if (object.url&&!object.deskPath) { link.href = object.url; link.hidden = false; }
  }
  lockControls.update([...new Set(ids.flatMap(id => fileGroup(renderedScene,id).map(object => object.id)))].map(id => desk.get(id)));
  for (const id of ['#front', '#back', '#delete', '#delete-animated']) $<HTMLButtonElement>(id).disabled = !ids.length;
  for(const id of ['#front','#back'])if(ids.some(id=>{const f=fileFor(renderedScene,id);return f&&f.id!==id;}))$<HTMLButtonElement>(id).disabled=true;
  fileCreate.disabled=!ids.length;
  bhDelete.refresh();cutoutControls.update();
  stickerControls.update();
  $('#object-list').replaceChildren();
  const listObjects = desk.snapshot().reverse().filter(objectListIncludes);
  const seriesNames = new Map(desk.settingsSnapshot().series.map(series => [series.id, series.name]));
  $('#count').textContent = String(listObjects.length);
  listObjects.forEach(object => {
    const button = document.createElement('button'); button.className = 'object-row';
    button.classList.toggle('active', ids.includes(object.id));
    const typeLabel = object.deskPath?t('tools:deskLink'):object.type === 'label' ? t('tools:pinsTitle', { name: seriesNames.get(object.seriesId!) ?? object.seriesId }) : t(`tools:objects.${object.type}`);
    button.textContent = `${typeLabel} · ${object.text.slice(0, 22) || object.id}`;
    button.onclick = event => attempt(() => {
      const current = desk.selected();
      desk.select(event.shiftKey || event.ctrlKey ? current.includes(object.id) ? current.filter(id => id !== object.id) : [...current, object.id] : [object.id]);
      // Let the list's selection scroll settle before starting the camera flight.
      requestAnimationFrame(focusHumanSelection);
    });
    $('#object-list').append(button);
  });
  const selectionKey = JSON.stringify(ids.slice().sort());
  const panel = $('#panel-objects');
  if (selectionKey !== previousObjectListSelection) {
    previousObjectListSelection = selectionKey;
    pendingObjectListSelection = ids.length > 0;
  }
  if (!ids.length) pendingObjectListSelection = false;
  if (pendingObjectListSelection && !$('#sidebar').hidden && !panel.hidden) {
    pendingObjectListSelection = false;
    if (ids.length && !$('#sidebar').hidden && !panel.hidden) {
      const row = $('#object-list').querySelector<HTMLButtonElement>('.object-row.active');
      if (row) {
        const bounds = row.getBoundingClientRect();
        const visibleTop = panel.getBoundingClientRect().top + panel.clientTop;
        const visibleBottom = visibleTop + panel.clientHeight;
        if (bounds.top < visibleTop) panel.scrollTop -= visibleTop - bounds.top;
        else if (bounds.bottom > visibleBottom) panel.scrollTop += bounds.bottom - visibleBottom;
      }
    }
  }
  refreshHistory();
}
function refreshHistory(){
  $('#history').replaceChildren();
  const changes = desk.getChanges(Math.max(0, desk.revision - 50), 50).changes.reverse();
  for (const change of changes) {
    const row = document.createElement('div'); row.className = 'history-row';
    const kinds = change.details.map(d => !d.before ? t('messages:added') : !d.after ? t('messages:deleted') : t('messages:changed'));
    row.textContent = `r${change.revision} · ${change.actor} · ${change.operation === 'batch' ? [...new Set(kinds)].join(' / ') : change.operation} (${change.targets.length})`;
    row.title = change.targets.join(', '); $('#history').append(row);
  }
}
const objectListVisibility = new MutationObserver(() => {
  if (!$('#sidebar').hidden && !$('#panel-objects').hidden) render(false);
});
for (const element of [$('#sidebar'), $('#panel-objects')]) {
  objectListVisibility.observe(element, { attributes: true, attributeFilter: ['hidden'] });
}
app.addEventListener('object-filter-change', event => {
  const kind = (event as CustomEvent<{ kind: 'apply' | 'category' }>).detail.kind;
  if (kind === 'category' && $('#object-filter-apply').getAttribute('aria-checked') !== 'true') return;
  pendingObjectListSelection = desk.selected().some(id => objectListIncludes(desk.get(id)));
  render(false);
});
function newPartPoint() {
  const offset = desk.summary().count % 8 * 22;
  const center = centeredPartPoint(camera,cameraSize(),{width:0,height:0},offset);
  return center;
}
function newObject(type: DeskObject['type'], extra: Partial<DeskObject> = {}) {
  const center = newPartPoint();
  const object = objectSchema.parse({ id: `${type}-${randomUuid().slice(0, 8)}`, type, ...gridPosition(center),
    ...(isShapeType(type) ? { textFit: 'shrink' } : {}),
    ...formatControls.appearance(type, desk.settingsSnapshot().defaults),
    ...initialPartSize(type),
    ...(type === 'qrcode'?{text:t('creation:qrcode'),qrText:defaultQrText}:{}),
    ...(type === 'mermaid' ? { text: 'Mermaid', mermaidSource: t('creation:mermaidSource') } : {}),
    ...(['line', 'arrow'].includes(type) ? {...initialLinePoints(center),...selectedConnection(desk.selected().map(id => desk.get(id)),desk.snapshot(),initialLineDelta)} : {}),
    ...extra });
  Object.assign(object,newPartGridSize(object,desk.settingsSnapshot().grid));
  if(!isConnector(object))Object.assign(object,gridPosition({x:center.x-object.width/2,y:center.y-object.height/2}));
  if (['text', 'web', 'link', 'mermaid', 'qrcode'].includes(type)) { editor.open(object, true); return; }
  execute([{ kind: 'add', object }], 'desk'); desk.select([object.id]);
}
const doodleButton=document.createElement('button');doodleButton.id='doodle-create';iconButton(doodleButton,'✎',t('messages:doodle'));$('#image').after(doodleButton);
doodleButton.onclick=()=>{if(busy||gesture||editor.isActive()||doodleEditor.isActive())return;attempt(()=>{const doodle=emptyDoodle();newObject('svg',{doodle,src:doodleSource(doodle,480,320),text:t('creation:doodle'),width:480,height:354});});};
app.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(button => button.onclick = () => {
  const kind = button.dataset.add!;
  const type = (kind === 'arrow' ? 'line' : kind) as DeskObject['type'];
  if (!busy && !editor.isActive()) attempt(() => newObject(type, kind === 'arrow' ? { endMarker: 'arrow' } : {}));
});
createShapePicker($<HTMLButtonElement>('[data-add="rect"]'), type => {
  if (!busy && !editor.isActive()) attempt(() => newObject(type));
});
$('[data-add="roundedRect"]').remove(); $('[data-add="ellipse"]').remove();

$('#undo').onclick = () => attempt(() => { desk.undo(); });
$('#clear-ai-pointing').onclick = () => { desk.point([]); drawSelection(); };
$('#redo').onclick = () => attempt(() => { desk.redo(); });
function deleteSelection() {
  const ids = desk.selected(); if (ids.length) attempt(() => execute(ids.map(id => ({ kind: 'delete', id }))));
}
function animateDelete(mode: DeleteMode) {
  if(busy||gesture||editor.isActive()||!desk.selected().length)return;
  objectAnimator.finish();
  const ids=desk.selected();
  void bhDeletion.run(desk,ids,mode,id=>drawnNodes.get(id),canvas,()=>camera,
    ()=>execute(ids.map(id=>({kind:'delete',id}))),()=>{render();notify(t('messages:revisionObjects',{revision:desk.revision,count:desk.summary().count}));})
    .catch(error=>notify(uiErrorMessage(error),true));
}
const bhDelete = bhDeleteControls($<HTMLButtonElement>('#delete'), animateDelete);
const cutoutControls=createCutoutControls($('#image'),form,()=>desk.selected().map(id=>desk.get(id)),operations=>{
  if(busy||gesture||editor.isActive())return;
  attempt(()=>execute(operations));
},id=>drawnNodes.get(id),notify);
const stickerContainer=document.createElement('div');stickerContainer.id='sticker-toolbar';stampContainer.after(stickerContainer);
const stickerControls=createStickerControls(form,()=>desk.selected().map(id=>desk.get(id)),operations=>{
  if(busy||gesture||editor.isActive())throw new Error(t('messages:finishStickers'));
  execute(operations);renderDecorations(operations.map(op=>'id' in op?op.id:''));notify(t('messages:stickersUpdated'));
},notify,stickerContainer);
$('#front').onclick = () => attempt(() => execute(desk.selected().map(id => ({ kind: 'reorder', id, index: desk.summary().count - 1 }))));
$('#back').onclick = () => attempt(() => execute(desk.selected().slice().reverse().map(id => ({ kind: 'reorder', id, index: 0 }))));
$('#card-fit-text').onclick = () => {
  if(busy||gesture||editor.isActive()||desk.selected().length!==1)return;
  const object=desk.get(desk.selected()[0]);
  if(object.type!=='text'||object.cutout||fileFor(desk.snapshot(),object.id))return;
  attempt(()=>{
    const measured=measureDeskText(desk,[object.id],id=>drawnNodes.get(id)).measurements[0];
    if(measured.status!=='measured')throw new Error(t(measured.status==='pending-fonts'?'messages:fontsLoading':'messages:cannotMeasure'));
    const grid=desk.settingsSnapshot().grid,step=grid.enabled?snapInterval(grid):1;
    const height=Math.max(step,Math.ceil(measured.requiredHeight!/step)*step);
    if(height>100000)throw new Error(t('editing:invalidValue'));
    if(height!==object.height)execute([{kind:'update',id:object.id,patch:{height}}]);
  });
};
$('#text-measure').onclick = () => {
  try {
  const report = measureDeskText(desk, desk.selected(), id => drawnNodes.get(id));
  $('#text-measure-result').textContent = report.measurements.map(item => {
    const name = desk.get(item.id).text.split('\n')[0].slice(0, 24) || item.id;
    if (item.status !== 'measured') return t('messages:measureStatus',{name,status:item.status==='pending-fonts'?t('messages:fontsLoading'):item.status==='unsupported'?t('messages:unsupported'):t('messages:cannotMeasure')});
    const state = item.overflow!.x || item.overflow!.y
      ? `${item.overflow!.x ? t('messages:overflowX') : ''}${item.overflow!.x && item.overflow!.y ? t('messages:overflowSeparator') : ''}${item.overflow!.y ? t('messages:overflowY') : ''}` : t('messages:fits');
    return t('messages:measureResult',{name,state,needed:item.requiredHeight,current:item.frame.height,warning:item.canFitByHeight?'':t('messages:heightInsufficient')});
  }).join('\n');
  } catch (error) { notify(uiErrorMessage(error), true); }
};
$('#zoom-in').onclick = () => zoom(1.25);
$('#zoom-out').onclick = () => zoom(0.8);
$('#zoom-reset').onclick = () => zoom(1 / camera.zoom);
$('#grid-snap').onclick = () => {
  if (!busy && !editor.isActive()) attempt(() => execute([{ kind: 'grid_update', patch: { enabled: !gridEnabled } }]));
};
function updatePinVisibilityButton() {
  const button = $('#label-descriptions');
  button.removeAttribute('aria-pressed');
  const key = pinVisibility === 'all' ? 'toolbar:pinText.caption' : pinVisibility === 'pins' ? 'controls:pinsOnly' : 'controls:hidePins';
  const name = t(key);
  button.title = t('controls:pinsTitle', { name });
  button.setAttribute('aria-label', button.title);
  uiText(button.querySelector('.tool-caption')!, key);
  button.dataset.pinVisibility = pinVisibility;
}
$('#label-descriptions').onclick = () => {
  pinVisibility = pinVisibility === 'all' ? 'pins' : pinVisibility === 'pins' ? 'hidden' : 'all';
  updatePinVisibilityButton(); render();
};
updatePinVisibilityButton();
function fitView(ids: string[], animation?: AnimationOptions) {
  const objects = (ids.length ? ids.map(id => desk.get(id)) : desk.snapshot()).filter(pinIsVisible)
    .map(object => pinDescriptionVisible(object) ? object : { ...object, description: '' });
  const next = fittedCamera(objects, canvas.clientWidth, canvas.clientHeight, true);
  if (!next) return;
  if (animation) return animateCamera(next, animation);
  cameraAnimator.cancel('Instant camera change');
  Object.assign(camera, next);
  cameraChanged(); drawSelection();
}
function focusObjects(ids: string[]) {
  void fitView(ids, {})?.catch(error => {
    if (!(error instanceof Error && error.message.startsWith('Camera animation cancelled:')))
      notify(uiErrorMessage(error), true);
  });
}
function focusHumanSelection() { focusObjects(desk.selected()); }
$('#fit').onclick = () => focusObjects(desk.selected().length ? desk.selected() : desk.pointed());
let wayfinderRun=0;
function beginWayfinder(raw:WayfinderStartInput){
  if(busy||editor.isActive()||identityControls.isEditing()||(isConfirmDialogOpen()||doodleEditor.isActive()||captureCamera.isActive())||document.hidden)throw new Error('Human editing or hidden desk; no wayfinder movement was started');
  const input=wayfinderStartSchema.parse(raw),scene=desk.snapshot().map(connectorForView);
  const first=input.id?wayfinderRoute(scene,input.id):lineRoute(scene,input.lineId!,input.from!);
  const mode=input.mode??(input.id?desk.get(input.id).wayfinderMode:undefined)??'move';
  return launchNavigation(first,mode,input,scene);
}
function startPinTravel(id:string,direction:'previous'|'next'){
  try{
    if(busy||editor.isActive()||identityControls.isEditing()||lineInput.isActive()||(isConfirmDialogOpen()||doodleEditor.isActive()||captureCamera.isActive())||document.hidden)throw new Error(t('messages:finishTravel'));
    const pin=desk.get(id),series=pinSeriesMap.get(pin.seriesId!);if(pin.type!=='label'||!series)return;
    const target=pinNeighbours(desk.snapshot(),series,id)[direction];if(!target)return;
    launchNavigation({points:[pinRoot(pin),pinRoot(target)],lineIds:[],destinationId:target.id},'move',{pinId:id},desk.snapshot());
  }catch(error){notify(uiErrorMessage(error),true);}
}
function launchNavigation(first:WayfinderRoute,mode:'move'|'tour',input:WayfinderStartInput&{pinId?:string},scene:DeskObject[]){
  const label=input.pinId?'messages:pinThread':'messages:wayfinder';
  const revision=desk.revision,generation=desk.documentGeneration,run=++wayfinderRun;
  cancelWayfinding('superseded');cameraAnimator.cancel('Wayfinder travel');objectAnimator.finish();
  const valid=()=>desk.revision===revision&&desk.documentGeneration===generation;
  const updateMarker=(marker:{x:number;y:number}|null)=>{wayfinderMarker.replaceChildren();if(marker)wayfinderMarker.append(svg('circle',{cx:marker.x,cy:marker.y,r:5/camera.zoom,fill:'#f59e0b',stroke:'#fff','stroke-width':2/camera.zoom}));};
  const reportStop=(reason:WayfinderStopReason)=>reason==='changed'?t('messages:routeChanged'):reason==='hidden'?t('messages:hiddenStop'):reason==='superseded'?t('messages:superseded'):reason==='timeout'?t('messages:travelTimeout'):t('messages:humanStop');
  navigation={runId:run,status:'moving',mode,id:input.id,lineId:input.lineId,from:input.from,pinId:input.pinId};
  const departureId=input.id??input.pinId;
  if(departureId){desk.select(desk.selected().filter(id=>id!==departureId));render(false);}else drawSelection();
  void(async()=>{
    let route:WayfinderRoute=first;
    while(run===wayfinderRun){
      navigation={...navigation!,status:'moving',reason:undefined,point:undefined,choices:undefined};
      notify(mode==='tour'?t('messages:tourNotice',{name:t(label)}):t('messages:travelNotice',{name:t(label)}));
      await wayfinderTravel.run(route.points,camera,cameraSize,valid,
        (next,marker)=>{Object.assign(camera,next);cameraChanged();drawSelection();updateMarker(marker);},reducedMotion.matches,mode);
      if(!valid())throw new WayfinderCancelled('changed');
      if(route.branch){
        navigation={...navigation!,status:'waiting',reason:'branch',point:route.branch.point,choices:route.branch.choices};
        updateMarker(route.branch.point);notify(t('messages:branch'));
        const choice=await wayfinderMap.choose(scene,route.branch,valid);
        if(!valid())throw new WayfinderCancelled('changed');
        updateMarker(null);route=lineRoute(scene,choice.lineId,choice.from);continue;
      }
      const reason=route.loop?'loop':route.destinationId?'arrived':'line-end';
      navigation={...navigation!,status:'completed',reason,point:cameraView(camera,cameraSize()).center};
      if(route.destinationId){desk.select([route.destinationId]);render(false);}else drawSelection();
      notify(route.loop?t('messages:loop'):route.destinationId?t('messages:arrived',{name:t(label)}):t('messages:lineEnd'));return;
    }
  })().catch(error=>{
    if(run!==wayfinderRun)return;updateMarker(null);
    if(error instanceof WayfinderCancelled){navigation={...navigation!,status:'cancelled',reason:error.reason,choices:undefined,point:cameraView(camera,cameraSize()).center};drawSelection();notify(label+'：'+reportStop(error.reason));return;}
    navigation={...navigation!,status:'failed',reason:'error',choices:undefined,message:error instanceof Error?error.message:String(error)};drawSelection();notify(uiErrorMessage(error),true);
  });
  return {id:input.id,lineId:input.lineId,from:input.from,runId:run,status:'started',mode,lineIds:first.lineIds,destinationId:first.destinationId};
}
function startWayfinder(id:string){try{beginWayfinder({id});}catch(error){notify(uiErrorMessage(error),true);}}

canvas.addEventListener('dblclick', event => {
  const target = document.elementFromPoint(event.clientX, event.clientY) ?? event.target as Element;
  if (target.closest('[data-open-url], [data-open-media], [data-open-desk], [data-markdown-link]')) return;
  const id = target.closest('[data-id]')?.getAttribute('data-id');
  if (!id || busy || editor.isActive() || lineInput.isActive()) return;
  const object = desk.get(id);
  if(object.doodle){if(!fileFor(desk.snapshot(),object.id))doodleEditor.open(object);else notify(t('messages:unfileDoodle'),true);return;}
  if (isShapeType(object.type) || ['text', 'link', 'web', 'label', 'image', 'svg', 'mermaid', 'qrcode', 'prop', 'file'].includes(object.type)) editor.open(object);
});
canvas.addEventListener('wheel', event => { event.preventDefault(); if (!gesture) zoom(Math.exp(-event.deltaY * 0.001), screen(event)); }, { passive: false });
// Middle-button release can paste the Linux primary selection after the pan ends.
canvas.addEventListener('auxclick', event => { if (event.button === 1) event.preventDefault(); });
canvas.addEventListener('pointerdown', event => {
  if (gesture || editor.isActive() || (event.button !== 0 && event.button !== 1)) return;
  if (!space && (event.target as Element).closest('[data-open-url], [data-open-media], [data-open-desk], [data-markdown-link]')) return;
  const target = event.target as Element;
  const resize = target.closest('[data-resize]')?.getAttribute('data-resize');
  const calloutTip = target.closest('[data-callout-tip]')?.getAttribute('data-callout-tip');
  const endpoint = target.closest('[data-endpoint]')?.getAttribute('data-endpoint');
  const id = target.closest('[data-id]')?.getAttribute('data-id');
  const p = world(event);
  let mode: Gesture['mode'];
  const extendSelection = event.shiftKey || event.ctrlKey;
  const additive = extendSelection ? desk.selected() : [];
  if (space || event.button === 1) mode = 'pan';
  else if (calloutTip) mode = 'callout';
  else if (resize) mode = 'resize';
  else if (endpoint === 'start' || endpoint === 'end') mode = endpoint;
  else if (id) {
    const ids = desk.selected();
    if (extendSelection) {
      desk.select(ids.includes(id) ? ids.filter(v => v !== id) : [...ids, id]);
      render(false); if (!desk.selected().includes(id)) return;
    } else if (!ids.includes(id)) { desk.select([id]); render(false); }
    if (desk.get(id).locked) { event.preventDefault(); canvas.focus(); return; }
    mode = 'move';
  } else { if (!extendSelection) desk.select([]); render(); mode = 'marquee'; }
  const scene = desk.snapshot();
  gesture = { mode, start: p, screen: screen(event), originals: desk.selected().map(id => mode === 'callout' ? connectorForView(desk.get(id)) : desk.get(id)), scene, snapScene: scene.filter(pinIsVisible), preview: scene, revision: desk.revision, camera: { x: camera.x, y: camera.y }, additive, grid: gridEnabled, gridSettings: desk.settingsSnapshot().grid, anchorId: id ?? resize ?? calloutTip ?? undefined, detach: event.altKey };
  busy = true; canvas.setPointerCapture(event.pointerId); event.preventDefault(); canvas.focus();
});
function previewGesture(current: Gesture, point: { x: number; y: number }) {
  const scene = gesturePreview(current, point, camera.zoom); renderedScene = scene;
  renderedById.clear(); for (const object of scene) renderedById.set(object.id, object);
  const hadRounding = renderedRounding.size > 0;
  renderedRounding = buildJunctionRounding(scene.map(connectorForView));
  updateScenePreview(objectsLayer, scene, current.preview, drawObject, hadRounding || renderedRounding.size > 0); current.preview = scene;
  refreshPinPresentation(); drawPinThreads(scene);
  drawSelection(scene.filter(o => desk.selected().includes(o.id)), scene);
  if(current.mode==='move'&&!current.detach&&current.originals.length===1) {
    const source=current.originals[0];
    const target=clipTarget(source)&&!fileFor(current.scene,source.id)&&!clipFor(current.scene,source.id)?clipDropTarget(current.scene,point,camera.zoom,[source.id]):null;
    const rulerHit=rulerTarget(source)&&!fileFor(current.scene,source.id)&&!clipFor(current.scene,source.id)&&!rulerFor(current.scene,source.id)?rulerDropTarget(current.scene,point,camera.zoom,[source.id]):null;
    if(rulerHit){const hint=svg('rect',{x:rulerHit.ruler.x,y:rulerHit.ruler.y,width:rulerHit.ruler.width,height:rulerHit.ruler.height,fill:'none',stroke:'#15803d','stroke-width':3/camera.zoom,'pointer-events':'none'});overlays.append(hint);}
    if(target){const text=svg('text',{x:target.x,y:target.y-12/camera.zoom,fill:'#15803d','font-size':14/camera.zoom,'pointer-events':'none'});text.textContent=t('messages:addClip');overlays.append(text);}
    if(source.type==='clip'&&!source.clipMembers?.length) drawSnapTargets(overlays,current.scene.filter(o=>clipTarget(o)&&!o.locked&&!clipFor(current.scene,o.id)),{x:source.x+source.width/2+point.x-current.start.x,y:source.y+source.height*.5+point.y-current.start.y},camera.zoom);
  }
  if (current.mode === 'move') for (const object of scene.filter(o => o.type === 'label' && desk.selected().includes(o.id))) {
    const origin = gridOrigin(object), size = 5 / camera.zoom;
    overlays.append(svg('line', { x1: origin.x, y1: origin.y, x2: origin.x, y2: origin.y + size * 2,
      stroke: '#2563eb', 'stroke-width': 1 / camera.zoom, opacity: 0.5, 'pointer-events': 'none' }));
    overlays.append(svg('path', { d: `M ${origin.x - size} ${origin.y - size * 1.5} L ${origin.x + size} ${origin.y - size * 1.5} L ${origin.x} ${origin.y} Z`,
      fill: '#2563eb', opacity: 0.3, 'pointer-events': 'none', 'data-grid-origin': object.id }));
  }
  if (!current.detach && current.mode === 'callout') drawSnapTargets(overlays,
    scene.filter(o=>!clipFollower(scene,o.id)).filter(pinIsVisible).filter(o => !isConnector(o) && o.id !== current.originals[0].id).map(o => pinScreenObject(o, camera.zoom)),
    { x: current.originals[0].callout!.x + point.x - current.start.x, y: current.originals[0].callout!.y + point.y - current.start.y }, camera.zoom);
  if (!current.detach && current.mode === 'move' && current.originals.length === 1 && ['label','wayfinder'].includes(current.originals[0].type)) {
    const pin = scene.find(o => o.id === current.originals[0].id)!;
    drawSnapTargets(overlays, scene.filter(o=>isPinAttachmentTarget(o,scene)).filter(pinIsVisible),
      { x: pin.x + attachmentOffset(pin).x, y: pin.y + attachmentOffset(pin).y }, camera.zoom);
  }
  if (!current.detach && (current.mode === 'start' || current.mode === 'end')) {
    const pointOnLine = endpointDragPoint(current, point);
    const resolved = endpointSnap(current, current.originals[0], pointOnLine, camera.zoom);
    drawSnapTargets(overlays, resolved.objects, pointOnLine, camera.zoom, resolved);
  }
}
canvas.addEventListener('pointermove', event => {
  desk.pointer = world(event);
  if (!gesture) return;
  gesture.detach = event.altKey;
  if ((gesture.mode === 'start' || gesture.mode === 'end') && Math.hypot(world(event).x - gesture.start.x, world(event).y - gesture.start.y) * camera.zoom > 2) gesture.endpointMoved = true;
  const p = world(event), delta = { x: p.x - gesture.start.x, y: p.y - gesture.start.y };
  if (gesture.mode !== 'pan' && gesture.mode !== 'marquee') { previewGesture(gesture, p); return; }
  if (gesture.mode === 'pan') {
    const s = screen(event); camera.x = gesture.camera.x + s.x - gesture.screen.x; camera.y = gesture.camera.y + s.y - gesture.screen.y; cameraChanged();

  } else {
    drawSelection();
    const color = frameColors(desk.settingsSnapshot().background).selection;
    overlays.append(svg('rect', { x: Math.min(p.x, gesture.start.x), y: Math.min(p.y, gesture.start.y), width: Math.abs(delta.x), height: Math.abs(delta.y), fill: color, 'fill-opacity': .13, stroke: color, 'stroke-width': 1 / camera.zoom }));
  }
});
function endGesture(event: PointerEvent, cancel = false) {
  const current = gesture; if (!current) return;
  gesture = null; busy = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (cancel) { render(); return; }
  current.detach = event.altKey;
  const p = world(event);
  if (current.mode !== 'pan' && current.mode !== 'marquee' && !gestureOperations(current, p, camera.zoom).length) {
    if (JSON.stringify(current.preview) !== JSON.stringify(current.scene)) render();
    else drawSelection();
    return;
  }
  attempt(() => {
    if (current.mode !== 'pan' && current.mode !== 'marquee') {
      const operations = gestureOperations(current, p, camera.zoom);
      if (operations.length) desk.execute({ actor: 'human', expectedRevision: current.revision, operations });
    } else if (current.mode === 'marquee') {
      const x1 = Math.min(p.x, current.start.x), x2 = Math.max(p.x, current.start.x);
      const y1 = Math.min(p.y, current.start.y), y2 = Math.max(p.y, current.start.y);
      const selected = desk.snapshot().filter(pinIsVisible).filter(object => {
        const o = object.type === 'label' ? labelVisualBounds(object, pinDescriptionVisible(object), camera.zoom) : headSelectedProp(object) ? propSelectionBounds(object) : bounds(object);
        return o.x >= x1 && o.y >= y1 && o.x + o.width <= x2 && o.y + o.height <= y2;
      }).map(o => o.id);
      desk.select([...new Set([...current.additive, ...selected])]);
    }
  });
}
canvas.addEventListener('pointerup', event => endGesture(event));
canvas.addEventListener('pointercancel', event => endGesture(event, true));
canvas.addEventListener('lostpointercapture', event => { if (gesture) endGesture(event, true); });
window.addEventListener('blur', () => { space = false; if (gesture) { gesture = null; busy = false; render(); } });
let keyboardEdit:{edit:KeyboardGeometryEdit,revision:number}|undefined;
function finishKeyboardEdit(){
  const current=keyboardEdit;if(!current)return;
  keyboardEdit=undefined;busy=false;
  try{
    const operations=current.edit.operations();
    if(operations.length)desk.commitGeometry({actor:'human',snap:'exact',expectedRevision:current.revision,operations});
    // Geometry changes do not alter the object list, tools, paint or selection.
    // Preserve unrelated DOM/media instead of rebuilding the entire desk on release.
    drawMoveFrame(desk.snapshot(),true);
    deskOverview.setObjects(renderedScene.filter(pinIsVisible));
    $('#revision').textContent=`rev. ${desk.revision}`;
    $<HTMLButtonElement>('#undo').disabled=!desk.summary().canUndo;
    $<HTMLButtonElement>('#redo').disabled=!desk.summary().canRedo;
    const ids=desk.selected();if(ids.length===1)propertyEditor.sync(desk.get(ids[0]));
    refreshHistory();
    notify(t('messages:revisionObjects',{revision:desk.revision,count:desk.summary().count}));
  }catch(error){render();notify(uiErrorMessage(error),true);}
}
window.addEventListener('keyup',event=>{if(event.key.startsWith('Arrow'))finishKeyboardEdit();});
window.addEventListener('blur',finishKeyboardEdit);
document.addEventListener('visibilitychange',()=>{if(document.hidden)finishKeyboardEdit();});
window.addEventListener('pointerdown',finishKeyboardEdit,true);
window.addEventListener('keydown', event => {
  if(keyboardEdit && (!event.key.startsWith('Arrow')||event.ctrlKey||event.metaKey))finishKeyboardEdit();
  if((isConfirmDialogOpen()||doodleEditor.isActive()||captureCamera.isActive()))return;
  if (editor.isActive()) return;
  if ((event.target as Element).closest('input,textarea,select') || colorControls.isOpen()) return;
  if (event.code === 'Space') { space = true; event.preventDefault(); }
  if (gesture) return;
  if (event.key.startsWith('Arrow') && !event.ctrlKey && !event.metaKey) {
    if((busy&&!keyboardEdit) || identityControls.isEditing() || (event.target as Element).closest('[contenteditable]:not([contenteditable="false"]),[role="dialog"],button'))return;
    event.preventDefault();
    try{
      keyboardEdit??={edit:new KeyboardGeometryEdit(renderedScene,desk.selected(),desk.settingsSnapshot().grid),revision:desk.revision};
      busy=true;
      keyboardEdit.edit.step(event.key,event.shiftKey,event.altKey,camera.zoom);
      drawMoveFrame(keyboardEdit.edit.scene,true);
    }catch(error){keyboardEdit=undefined;busy=false;render();notify(uiErrorMessage(error),true);}
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='g') {
    event.preventDefault();if(busy)return;
    attempt(()=>{const scene=desk.snapshot(),selected=desk.selected();const files=selected.filter(id=>desk.get(id).type==='file');
      if(selected.some(id=>fileFor(scene,id)&&desk.get(id).type!=='file'))throw new Error(t('messages:groupInFile'));
      if(files.length&&(!event.shiftKey||files.length!==selected.length))throw new Error(t('messages:mergeFiles'));
      const operations:Operation[]=files.length?files.map(id=>({kind:'delete',id})):event.shiftKey?unbundleOperations(scene,selected):bundleOperations(scene,selected);
      if(operations.length){execute(operations);if(!event.shiftKey&&operations[0].kind==='add')desk.select([operations[0].object.id]);}});return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelection(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); attempt(() => { if (event.shiftKey) desk.redo(); else desk.undo(); }); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); attempt(() => { desk.redo(); }); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); attempt(() => { desk.select(desk.snapshot().map(o => o.id)); }); }
  if (event.key === 'Escape') attempt(() => { desk.select([]); });
});
window.addEventListener('keyup', event => { if (event.code === 'Space') space = false; });

async function addFiles(files: File[]) {
  const operations: Operation[] = [];
  busy = true;
  try {
    for (const file of files) {
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'].includes(file.type)) throw new Error(t('messages:unsupportedImage'));
      if (file.size > MAX_ASSET_BYTES) throw new Error(t('messages:imageLimit'));
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error(t('messages:imageReadFailed'))); reader.readAsDataURL(file);
      });
      const image = new Image(); image.src = src;
      await image.decode();
      const type=file.type==='image/svg+xml'?'svg':'image';
      const size=newPartGridSize({type,...initialImageSize(image.naturalWidth,image.naturalHeight)},desk.settingsSnapshot().grid);
      operations.push({ kind: 'add', object: objectSchema.parse({
        id: `image-${randomUuid().slice(0, 8)}`, type: file.type === 'image/svg+xml' ? 'svg' : 'image', src,
        ...size,...gridPosition(centeredPartPoint(camera,cameraSize(),size,operations.length*24)),text:file.name,
      }) });
    }
    if (operations.length) attempt(() => { execute(operations); desk.select(operations.map(op => op.kind === 'add' ? op.object.id : '')); });
  } catch (error) { notify(uiErrorMessage(error), true); }
  finally { busy = false; }
}
function clipboardTextTarget(target: EventTarget | null) {
  return editor.isActive() || identityControls.isEditing() || colorControls.isOpen()
    || target instanceof Element && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
}
for (const kind of ['copy', 'cut'] as const) window.addEventListener(kind, event => {
  if((isConfirmDialogOpen()||doodleEditor.isActive()||captureCamera.isActive())){event.preventDefault();return;}
  if (clipboardTextTarget(event.target) || !getSelection()?.isCollapsed || busy || gesture || !event.clipboardData) return;
  const scene=desk.snapshot();
  const selected=new Set(desk.selected().flatMap(id=>['clip','file','ruler'].includes(desk.get(id).type)?fileGroup(scene,id).map(o=>o.id):[id]));
  const objects = scene.filter(object => selected.has(object.id));
  if (!objects.length) return;
  event.preventDefault();
  try {
    const copied = partClipboard.write(event.clipboardData, objects,desk.settingsSnapshot().series);
    if (kind === 'cut') {
      desk.execute({ actor: 'human', expectedRevision: desk.revision, operations: objects.map(object => ({ kind: 'delete', id: object.id })) });
      render();
    }
    notify(t(kind==='cut'?'messages:cut':'messages:copied',{count:copied.count,scope:copied.text?'':t('messages:localPasteOnly')}));
  } catch (error) { notify(uiErrorMessage(error), true); }
});
async function pasteClipboard(content: ClipboardContent) {
  if (partClipboard.matches(content.token, content.html)) {
    desk.select(partClipboard.paste(desk));
    render(); notify(t('messages:pasted',{count:desk.selected().length}));
    return;
  }
  const token=partClipboardToken(content.token,content.html);
  if(token){
    const revision=desk.revision,generation=desk.documentGeneration;
    let remote:unknown=null;
    try{remote=await recovery.clipboardRequest(token);}catch{/* Best effort: ordinary paste remains available. */}
    if(desk.revision!==revision||desk.documentGeneration!==generation||(isConfirmDialogOpen()||doodleEditor.isActive()||captureCamera.isActive())||editor.isActive()||identityControls.isEditing()||gesture)throw new Error(t('messages:pasteChanged'));
    const parsed=clipboardTransferSchema.safeParse(remote);
    if(parsed.success&&parsed.data.token===token){
      const frames=parsed.data.objects.map(bounds),left=Math.min(...frames.map(b=>b.x)),top=Math.min(...frames.map(b=>b.y));
      const right=Math.max(...frames.map(b=>b.x+b.width)),bottom=Math.max(...frames.map(b=>b.y+b.height));
      const origin=gridPosition(centeredPartPoint(camera,cameraSize(),{width:right-left,height:bottom-top}));
      // The existing paste transaction remaps every ID/reference and creates independent pin series.
      desk.select(partClipboard.pasteRemote(desk,parsed.data,token,{x:origin.x-left,y:origin.y-top}));
      render();notify(t('messages:pastedFromDesk',{count:desk.selected().length}));return;
    }
  }
  if (content.files.length) { await addFiles(content.files); return; }
  const file = svgClipboardFile(content.text);
  if (file) { await addFiles([file]); return; }
  if (!content.text.trim()) { notify(t('messages:nothingToPaste'), true); return; }
  if (content.text.length > 100_000) throw new Error(t('messages:pasteTextLimit'));
  const url = singleClipboardUrl(content.text);
  const id = `${url ? 'link' : 'text'}-${randomUuid()}`;
  const type=url?'link':'text';
  const appearance=formatControls.appearance(type,desk.settingsSnapshot().defaults);
  const size=initialPartSize(type) as {width:number;height:number};
  execute([{ kind: 'add', object: { ...appearance,
    id, type, ...size,...gridPosition(centeredPartPoint(camera,cameraSize(),size)),
    text: url ?? content.text, ...(url ? { url } : {}) } }]);
  desk.select([id]); render(); notify(url ? t('messages:linkPasted') : t('messages:cardPasted'));
}
$('#clipboard').onclick = async () => {
  if (busy || gesture || editor.isActive() || identityControls.isEditing()) return;
  const revision = desk.revision;
  busy = true;
  try {
    const content = await readClipboardContent();
    if (desk.revision !== revision) throw new Error(t('messages:pasteReadChanged'));
    await pasteClipboard(content);
  } catch (error) {
    notify(error instanceof DOMException && error.name === 'NotAllowedError'
      ? t('messages:clipboardPermission')
      : uiErrorMessage(error), true);
  } finally { busy = false; }
};
$('#image').onclick = () => { $<HTMLInputElement>('#file').click(); };
$<HTMLInputElement>('#file').onchange = event => { const input = event.target as HTMLInputElement; void addFiles([...input.files ?? []]); input.value = ''; };
$('#workspace').addEventListener('dragover', event => { event.preventDefault(); });
$('#workspace').addEventListener('drop', event => { event.preventDefault(); if (!busy) void addFiles([...event.dataTransfer?.files ?? []]); });
// Some Linux browsers emit paste before auxclick, after pointerup has ended the pan.
// Keep its origin until the next independent mouse or keyboard action.
let middleCanvasPaste = false;
window.addEventListener('pointerdown', event => {
  middleCanvasPaste = event.button === 1 && event.target instanceof Node && canvas.contains(event.target)
    && !clipboardTextTarget(event.target);
}, true);
window.addEventListener('keydown', () => { middleCanvasPaste = false; }, true);
window.addEventListener('paste', event => {
  if((isConfirmDialogOpen()||doodleEditor.isActive()||captureCamera.isActive())){event.preventDefault();return;}
  if (middleCanvasPaste) { event.preventDefault(); return; }
  if (clipboardTextTarget(event.target) || busy || gesture || !event.clipboardData) return;
  const data = event.clipboardData;
  const content: ClipboardContent = { text: data.getData('text/plain'), html: data.getData('text/html'),
    token: data.getData(partClipboardType), files: [...data.files] };
  if (!content.text && !content.files.length && !partClipboardToken(content.token,content.html)) return;
  event.preventDefault();
  busy = true;
  void pasteClipboard(content).catch(error => notify(uiErrorMessage(error), true))
    .finally(() => { busy = false; });
});

const recovery = new BrowserConnection({
  identity: id => { desk.deskId=id; render(); },
  beforeRelease: () => thinkingMode.assertAllowed('release'),
  handoff: url => { void connectionPanel.display(url); },
  handoffError: message => notify(uiErrorMessage(message), true),
  disconnected: () => { cancelWayfinding('changed');cancelConfirmDialog(); bhDeletion.stop(); activityLed.clear(); objectAnimator.finish(); cameraAnimator.cancel('Desk disconnected'); desk.point([]); drawSelection(); },
  status: (state, detail, detailKey) => {
    bellControls.connected(state==='connected');
    if (state === 'connected') connectionPanel.hide();
    const status = $('#connection');
    uiText(status, state === 'connected' ? 'shell:connected' : state === 'released' ? 'shell:released' : state === 'blocked' ? 'shell:blocked' : 'shell:reconnecting');
    status.classList.toggle('connected', state === 'connected');
    status.classList.toggle('error', state === 'blocked');
    const detailNode=$('#connection-detail');
    if(detailKey)uiText(detailNode,detailKey);else{detailNode.removeAttribute('data-i18n');detailNode.textContent=detail;}
    if (state === 'blocked') notify(detail, true);
    else if ($('#message').dataset.connection === 'true') notify('');
    $('#message').dataset.connection = state === 'blocked' ? 'true' : 'false';
  },
});
const deskToast=createDeskToast();
const connectionPanel = connectionControls(app, () => recovery.requestHandoff(), message => notify(message, true));
async function connect(token: string, port: string, manual = false, host = '127.0.0.1', current=()=>true) {
  if (manual && (recovery.hasPairing() || desk.summary().count > 0) && !await confirmAction(t('messages:switchConnectionTitle'),t('messages:switchConnectionMessage'),t('messages:switchConnection'))) return;
  if(!current())return;
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535 || token.length < 22) { notify(t('messages:invalidConnection'), true); return; }

  // Do not serialize flights in the protocol chain: reads/release must remain responsive.
  recovery.connect(token, port, async (ws, event) => {
    let id: string | undefined;
    try {
      const message = JSON.parse(String(event.data));
      if(message.type==='desk_toast'){deskToast.show(message);return;}
      if(message.type==='bell_state'){bellControls.update(message);return;}
      if(message.type==='bell_collected'){bellControls.collected(message);return;}
      if(message.type==='ai_activity'){activityLed.pulse('tool');return;}
      id = message.id;
      if (typeof id !== 'string') throw new Error('Invalid request ID');
      if(message.request?.method==='file_snapshot'){
        thinkingMode.assertAllowed('file_snapshot');
        const revision=desk.revision,generation=desk.documentGeneration,sessionId=desk.sessionId,count=desk.summary().count;
        const bytes=await encodeDeskFile(desk);
        ws.send(JSON.stringify({id,result:{revision,generation,sessionId,count,archiveDataUrl:bytesDataUrl(bytes)}}));return;
      }
      if(message.request?.method==='load_document'&&message.request.document?.archiveDataUrl){
        const decoded=await decodeDeskFile(dataBytes(message.request.document.archiveDataUrl));
        message.request.document={objects:decoded.objects,settings:decoded.settings};
        message.missingAssets=decoded.warnings;
      }
      if(message.request?.method==='clipboard_read'){const result=partClipboard.export(message.request.token);ws.send(JSON.stringify({id,result}));return;}
      if (typeof message.request?.method === 'string') activityLed.pulse(message.request.method);
      thinkingMode.assertAllowed(message.request?.method);
      if(deskFiles.isBusy()&& !['summary','get','list','state','context','settings','selection','changes','file_saved','camera_get','ui_get'].includes(message.request?.method))throw new Error('Human file operation in progress. No change was made.');
      if((isConfirmDialogOpen()||doodleEditor.isActive()||captureCamera.isActive())&&['pin_fit','execute','lock','undo','redo','select','point','load_document','fit','camera_move','wayfinder_start','ui_set'].includes(message.request?.method))throw new Error('Human confirmation in progress. No change was made; wait for the user.');
      if (['fit', 'camera_move','wayfinder_start'].includes(message.request.method)) humanScroll.assertIdle();
      if ((busy && message.request.method!=='camera_get') || (lineInput.isActive() && !['camera_get','summary','context','list','get','state','selection','settings','changes','file_saved','asset_read','ui_get','text_measure','raster','pdf_export'].includes(message.request.method)) || ((editor.isActive() || identityControls.isEditing()) && ['pin_fit', 'execute', 'lock', 'undo', 'redo', 'select', 'load_document'].includes(message.request.method))) throw new Error('Human editing in progress. Retry after it completes.');
      if (['fit', 'camera_move','wayfinder_start'].includes(message.request.method) && (gesture || editor.isActive() || identityControls.isEditing() || lineInput.isActive())) throw new Error('Human editing in progress. No camera change was made.');
      if (['pin_fit', 'execute', 'lock', 'undo', 'redo', 'select', 'point', 'load_document', 'fit', 'camera_move', 'wayfinder_start', 'ui_set'].includes(message.request.method)) objectAnimator.finish();
      const beforeMove = message.request.method === 'execute' ? desk.snapshot() : null;
      let animatedMove = false;
      if (message.request.method === 'load_document') {cancelWayfinding('changed');cameraAnimator.cancel('Desk contents replaced');}
      const beforeRevision=desk.revision;
      let result = dispatch(desk, message.request, cameraControls, ids => measureDeskText(desk, ids, id => drawnNodes.get(id)), { get: () => ({ theme: getUiTheme() }), set: setUiTheme }, renderMermaid, scale => rasterPointedCard(desk, id => drawnNodes.get(id), scale),text=>renderQrCode(text,getUiLanguage()),{
        pdf:async()=>{
          const r=await deskPdf(desk,canvas,id=>pinDescriptionVisible(desk.get(id)));
          if(r.bytes.length>MAX_PDF_EXPORT_BYTES)throw new Error('PDF exceeds 250MB');
          const base64=await new Promise<string>((resolve,reject)=>{
            const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('PDF encoding failed'));
            reader.readAsDataURL(new Blob([r.bytes.slice().buffer],{type:'application/pdf'}));
          });
          return{sessionId:desk.sessionId,revision:r.revision,bounds:r.bounds,raster:r.raster,webCount:r.webCount,base64};
        },
        capture:async input=>{
          const bounds=captureBounds(desk,input);
          const r=await deskSceneRaster(desk,canvas,id=>pinDescriptionVisible(desk.get(id)),bounds,input.scale);
          const dataUrl=r.bitmap.toDataURL('image/png');checkAssetBytes(dataBytes(dataUrl).length);
          return{sessionId:desk.sessionId,revision:r.revision,bounds:r.bounds,width:r.raster.width,height:r.raster.height,scale:r.raster.scale,webCount:r.webCount,dataUrl};
        },
        pinFit:input=>{
          const operations=browserPinFitOperations(desk,input.seriesIds);
          const result=desk.execute({actor:input.actor,expectedRevision:input.expectedRevision,snap:'exact',operations});
          return{...result,frames:operations.map(op=>op.kind==='series_update'?{seriesId:op.id,...op.patch}:null)};
        },
      });
      if(desk.revision!==beforeRevision)cancelWayfinding('changed');
      if (['camera_move', 'mermaid_render', 'qr_render', 'raster', 'pdf_export'].includes(message.request.method)) result = await result;
      if (message.request.method === 'fit') {
        const ids = desk.pointed();
        await fitView(ids, { durationMs: message.request.durationMs });
        result = { ids, scope: ids.length ? 'selection' : 'all', camera: { ...camera } };
      }
      if (beforeMove && message.request.actor !== 'human' && !document.hidden && !reducedMotion.matches) {
        const flight = pointedMove(beforeMove, desk.snapshot(), desk.pointed(), message.request.operations, message.request.durationMs);
        if (flight) {
          cameraAnimator.cancel('Object movement started');
          canvas.dataset.objectMoving = 'true';
          const status = await objectAnimator.run(flight, drawMoveFrame, () => { delete canvas.dataset.objectMoving; render(); });
          animatedMove = true;
          result = { ...(result as Record<string, unknown>), animation: { status, durationMs: flight.durationMs, ids: flight.ids } };
        }
      }
      if(message.request.method==='load_document'&&message.missingAssets)result={...(result as object),missingAssets:message.missingAssets};
      ws.send(JSON.stringify({ id, result }));
      // Read-only requests must not rebuild iframes or steal form edits.
      if (message.request.method === 'point') drawSelection();
      if (!animatedMove && ['pin_fit', 'execute', 'lock', 'undo', 'redo', 'select', 'load_document'].includes(message.request.method)) render();
      if (message.request.method === 'load_document') { bhDeletion.stop();partClipboard.clear(); if(desk.filePath)deskFiles.record(desk.filePath);fitView(desk.selected()); }
      if(message.request.method==='file_saved'&&desk.filePath&&(!message.request.expectedGeneration||message.request.expectedGeneration===desk.documentGeneration))deskFiles.record(desk.filePath);
    } catch (error) { ws.send(JSON.stringify({ id, error: error instanceof Error ? error.message : String(error) })); }
  }, manual, host);
}
let connectionAttempt = 0;
async function connectUrl(value: string, manual: boolean) {
  if(pagesMode)throw new Error(t('messages:pagesNoConnection'));
  const attempt = ++connectionAttempt;
  let allowedHosts = ['127.0.0.1', 'localhost'];
  try {
    const response = await fetch('/connection-policy', { cache: 'no-store' });
    if (response.ok) {
      const policy = await response.json();
      if (Array.isArray(policy.allowedHosts) && policy.allowedHosts.every((host: unknown) => typeof host === 'string')) allowedHosts = policy.allowedHosts;
    }
  } catch { /* Fail closed for LAN; local URLs remain usable during downtime. */ }
  if (attempt !== connectionAttempt) return;
  let parsed:ReturnType<typeof parseConnectionUrl>;
  try{parsed=parseConnectionUrl(value,allowedHosts);}catch(error){if(error instanceof ConnectionUrlError)throw new Error(t(`connection:${error.code}`));throw error;}
  if (!parsed.token) throw new Error(t('messages:missingToken'));
  await connect(parsed.token, parsed.port, manual, parsed.host,()=>attempt===connectionAttempt);
}
$<HTMLFormElement>('#connect-form').onsubmit = event => {
  event.preventDefault();
  try {
    const url = $<HTMLInputElement>('#connection-url');
    void connectUrl(url.value, true).catch(error => notify(uiErrorMessage(error), true));
  } catch (error) { notify(uiErrorMessage(error), true); }
};
const startupParameters=new URLSearchParams(location.search);
const launchName=startupParameters.get('newDeskName');
const suggestedDeskName=launchName===null?null:localizedLaunchName(launchName,startupParameters.get('newDeskNameAuto')==='1',t('creation:untitled'));
if(suggestedDeskName&&!desk.list().length&&!desk.settingsSnapshot().name){
 try{desk.execute({operations:[{kind:'desk_rename',name:suggestedDeskName}]});notify(t('messages:deskNamed',{name:suggestedDeskName}));}catch{/* Invalid launch hints never prevent opening a desk. */}
}
if(launchName!==null||startupParameters.has('newDeskNameAuto')){
 startupParameters.delete('newDeskName');startupParameters.delete('newDeskNameAuto');history.replaceState(null,'',location.pathname+(startupParameters.size?'?'+startupParameters.toString():'')+location.hash);
}
const standaloneStartup=pagesMode||startupParameters.get('connect')==='off';
if(standaloneStartup){
  if(location.hash)history.replaceState(null,'',location.pathname+location.search);
  uiText($('#connection'),'messages:standalone');
  uiText($('#connection-detail'),'messages:standaloneHelp');
}
if (location.hash&&!standaloneStartup) {
  const initialUrl = location.href;
  history.replaceState(null, '', location.pathname + location.search);
  $<HTMLInputElement>('#connection-url').value = initialUrl;
  void connectUrl(initialUrl, false).catch(error => notify(uiErrorMessage(error), true));
}
const lineInput=createLineInput(canvas,viewport,$<HTMLButtonElement>('[data-add="line"]'),desk,world,()=>camera.zoom,
 ()=>formatControls.appearance('line',desk.settingsSnapshot().defaults),()=>render(),()=>!busy&&!gesture&&!editor.isActive()&&!identityControls.isEditing()&&!(isConfirmDialogOpen()||doodleEditor.isActive()||captureCamera.isActive()),notify,()=>desk.snapshot().filter(pinIsVisible).map(o=>pinScreenObject(o,camera.zoom)));
const deskOverview=createDeskOverview($('#workspace'),canvas,$('#message'),camera);
createTopbarCollapse(app,()=>!busy&&!gesture&&!editor.isActive()&&!identityControls.isEditing()&&!doodleEditor.isActive()&&!captureCamera.isActive()&&!lineInput.isActive()&&!isConfirmDialogOpen(),()=>{stopCamera();drawSelection();editor.reposition();});
render();

if(pagesMode){
 uiText($('#empty small'),'messages:pagesEmptyHint');
 const reference=startupParameters.get('desk');
 if(reference)void deskFiles.openInitial(reference).then(async loaded=>{
  if(!loaded)return;
  if(startupParameters.get('pdf'))return deskFiles.openPdfHere();
  const id=initialFocusTarget(startupParameters,desk.settingsSnapshot().initialFocusId);
  if(!id)return;
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  if(!desk.snapshot().some(object=>object.id===id)){
    desk.select([]);fitView([]);notify(t('messages:focusMissing',{id}),true);return;
  }
  desk.select([id]);fitView([id]);
 });
}

// Update application chrome without replacing the document or reconnecting the browser.
document.addEventListener(languageChangeEvent, () => { translateUi(app); updatePinVisibilityButton(); render(false); });
