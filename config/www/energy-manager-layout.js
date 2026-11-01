/* Energy Manager v7.2.4 */
(() => {
  const TAG = 'energy-manager-layout';
  if (customElements.get(TAG)) return;
  const CSS = `
energy-manager-layout{display:block;min-width:0}energy-manager-layout *{box-sizing:border-box}
energy-manager-layout .em-toolbar{display:flex;gap:7px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin:7px 0 12px}
energy-manager-layout .em-status{font-size:12px;opacity:.75;margin-right:auto}
energy-manager-layout button{font:inherit;background:var(--card-background-color,var(--ha-card-background,#242424));color:var(--primary-text-color);border:1px solid var(--divider-color,#666);border-radius:6px;padding:5px 9px;cursor:pointer}
energy-manager-layout button:disabled{opacity:.4;cursor:default}
energy-manager-layout .em-error{color:var(--error-color,#ef5350);font-size:13px}
energy-manager-layout .em-picker{border:1px solid var(--divider-color,#666);border-radius:9px;padding:12px;margin-bottom:12px}
energy-manager-layout .em-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px;margin-top:10px}
energy-manager-layout .em-option{display:flex;gap:7px;align-items:center;font-size:13px}
energy-manager-layout .em-column-notices{display:flex;flex-direction:column;gap:9px;min-width:0}
energy-manager-layout .em-column-notices>*{display:block;min-width:0;width:100%}
energy-manager-layout .em-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;align-items:start}
energy-manager-layout .em-column{display:flex;flex-direction:column;gap:9px;min-width:0}
energy-manager-layout .em-row{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:9px;align-items:start;min-width:0}
energy-manager-layout .em-tile{min-width:0;position:relative;flex-shrink:0;display:flex;flex-direction:column}
energy-manager-layout .em-card{min-width:0;width:100%;display:block}
energy-manager-layout .em-edithead{display:none;align-items:center;gap:4px;font-size:12px;padding:3px 4px;background:var(--secondary-background-color,#303030);border:1px dashed var(--divider-color,#777);border-radius:7px 7px 0 0;min-height:30px}
energy-manager-layout .em-editing .em-edithead{display:flex}
energy-manager-layout .em-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;font-weight:600}
energy-manager-layout .em-grip{cursor:grab;touch-action:none;font-size:16px;padding:1px 5px}
energy-manager-layout .em-edithead button{padding:2px 5px;font-size:12px;min-width:25px}
energy-manager-layout .em-tile.em-dragging{opacity:.4}
energy-manager-layout .em-width-handle{display:none;position:absolute;right:-5px;top:30px;bottom:0;width:12px;z-index:4;cursor:ew-resize;touch-action:none;align-items:center;justify-content:center}
energy-manager-layout .em-editing .em-width-handle{display:flex}
energy-manager-layout .em-width-handle::after{content:"";width:4px;height:32px;border-radius:4px;background:var(--primary-color,#03a9f4);opacity:.75}
energy-manager-layout .em-tile.em-resizing{outline:1px dashed var(--primary-color,#03a9f4);outline-offset:2px}
energy-manager-layout .em-tile.em-resizing .em-width-handle::after{opacity:1}

energy-manager-layout .em-row.em-target{outline:2px dashed var(--primary-color,#03a9f4);outline-offset:2px;border-radius:6px}
energy-manager-layout .em-drop-end{min-height:32px;border:1px dashed transparent;border-radius:6px}
energy-manager-layout .em-editing .em-drop-end{border-color:var(--divider-color,#555)}
energy-manager-layout .em-drop-end.em-target{border:2px dashed var(--primary-color,#03a9f4)}
energy-manager-layout .em-hint{font-size:12px;opacity:.75;margin-top:9px}
@media(max-width:900px){energy-manager-layout .em-columns{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:590px){energy-manager-layout .em-columns{grid-template-columns:minmax(0,1fr)}energy-manager-layout .em-toolbar{justify-content:flex-end}}
`;
  const el=(tag,cls='',value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=value;return node;};
  const button=(label,fn)=>{const node=el('button','',label);node.type='button';node.addEventListener('click',fn);return node;};
  class Layout extends HTMLElement {
    constructor(){super();this._config=null;this._configs=[];this._elements=[];this._layout={};this._hass=null;this._rev=0;this._editing=false;this._picker=false;this._busy=false;this._dirty=false;this._error='';this._generation=0;this._eligibility='';this._drag=null;}
    setConfig(config){this._config=config;this._configs=config.cards||[];this._layout={};this._render();if(this._hass)this._fetch();}
    set cards(cards){const next=cards||[];const changed=next.length!==this._elements.length||next.some((v,i)=>v!==this._elements[i]);this._elements=next;if(changed)this._render();}
    get cards(){return this._elements;}
    set hass(value){const first=!this._hass;this._hass=value;const signature=this._eligibilitySignature();if(signature!==this._eligibility){this._eligibility=signature;this._render();}if(first&&this._config)this._fetch();}
    get hass(){return this._hass;}
    set narrow(value){this._narrow=value;}
    get narrow(){return this._narrow;}
    connectedCallback(){this._render();}
    _meta(i){const o=this._configs[i]?.view_layout||{};return{id:String(o.em_id||`card-${i}`),name:String(o.em_name||`Card ${i+1}`),fixed:!!o.em_fixed,required:!!o.em_required,defaultColumn:Math.max(0,Math.min(2,Number(o.em_column??i%3))),defaultOrder:Number(o.em_order??i)};}
    _eligible(i){const card=this._configs[i];if(card?.type!=='conditional'||!Array.isArray(card.conditions))return true;if(!this._hass?.states)return false;return card.conditions.every(rule=>{const state=this._hass.states[rule.entity]?.state;if(state===undefined)return false;const values=v=>(Array.isArray(v)?v:[v]).map(String);return(rule.state===undefined||values(rule.state).includes(state))&&(rule.state_not===undefined||!values(rule.state_not).includes(state));});}
    _eligibilitySignature(){return this._configs.map((_,i)=>this._eligible(i)?'1':'0').join('');}
    _defaultWidth(i){const v=Number(this._configs[i]?.view_layout?.em_width);return Number.isInteger(v)?Math.max(1,Math.min(12,v)):12;}
    _state(i){const m=this._meta(i),s=this._layout[m.id]||{};const col=Number.isInteger(s.col)?s.col:m.defaultColumn;const order=Number.isInteger(s.order)?s.order:m.defaultOrder;return{col:Math.max(0,Math.min(2,col)),order, width:(Number.isInteger(s.width)&&s.width>=1&&s.width<=12?s.width:this._defaultWidth(i)),hidden:!m.required&&(typeof s.hidden==='boolean'?s.hidden:this._configs[i]?.view_layout?.em_hidden===true)};}
    _eligibleItems(){return this._configs.map((_,i)=>i).filter(i=>!this._meta(i).fixed&&this._eligible(i));}
    _ordered(col,includeHidden=false){return this._eligibleItems().filter(i=>{const s=this._state(i);return s.col===col&&(includeHidden||!s.hidden);}).sort((a,b)=>this._state(a).order-this._state(b).order||a-b);}
    _scrollSnapshot(){
      const result=[]; const seen=new Set();
      const add=node=>{if(!node||seen.has(node))return;seen.add(node);if(typeof node.scrollTop==='number')result.push({node,top:node.scrollTop,left:node.scrollLeft});};
      add(document.scrollingElement);
      let node=this;
      while(node){
        add(node);
        const parent=node.parentNode;
        if(parent){node=parent.nodeType===11&&parent.host?parent.host:parent;}
        else {const root=node.getRootNode?.();node=root?.host||null;}
      }
      return {result,windowX:window.scrollX,windowY:window.scrollY};
    }
    _restoreScroll(snapshot){
      if(!snapshot)return;
      for(const {node,top,left} of snapshot.result){
        if(node.isConnected){node.scrollTop=top;node.scrollLeft=left;}
      }
      // Home Assistant can scroll its dashboard in a shadow-root container;
      // restoring window.scrollY alone does not cover that case.
      if(window.scrollX!==snapshot.windowX||window.scrollY!==snapshot.windowY)
        window.scrollTo(snapshot.windowX,snapshot.windowY);
    }
    _render(){if(!this.isConnected||!this._config||this._elements.length!==this._configs.length)return;
      const scroll=this._scrollSnapshot();
      this.replaceChildren();const style=el('style');style.textContent=CSS;this.append(style);const root=el('div',this._editing?'em-editing':'');this.append(root);
      const toolbar=el('div','em-toolbar');root.append(toolbar);if(this._error)toolbar.append(el('span','em-status',this._error));
      const customise=button(this._editing?'✓ Finish customising':'✥ Customise',()=>{this._editing=!this._editing;this._render();});customise.disabled=!this._hass?.user?.is_admin;toolbar.append(customise);
      toolbar.append(button('☷ Show / hide',()=>{this._picker=!this._picker;this._render();}));
      if(this._editing){toolbar.append(button('↺ Reset defaults',()=>{if(confirm('Restore the default arrangement and visibility of all optional cards?')){this._layout={};this._render();this._save();}}));toolbar.append(button('⟳ Reload saved',()=>{this._dirty=false;this._fetch();}));}
      if(this._picker){const panel=el('div','em-picker');panel.append(el('strong','','Cards available on this system'));const options=el('div','em-options');for(const i of this._eligibleItems()){const m=this._meta(i),opt=el('label','em-option'),input=el('input');input.type='checkbox';input.checked=!this._state(i).hidden;input.disabled=m.required||!this._hass?.user?.is_admin;input.addEventListener('change',()=>{if(m.required)return;this._update(i,{hidden:!input.checked});});opt.append(input,document.createTextNode(m.name+(m.required?' (always visible)':'')));options.append(opt);}panel.append(options);root.append(panel);}
      // Fixed notifications are not movable or hideable, but belong to their
      // configured main column. em_width is measured within that column.
      const columns=el('div','em-columns');root.append(columns);for(let col=0;col<3;col++){const column=el('div','em-column');column.dataset.column=String(col);columns.append(column);
        const fixed=this._configs.map((_,i)=>i).filter(i=>{const m=this._meta(i);return m.fixed&&m.defaultColumn===col&&this._eligible(i);}).sort((a,b)=>this._meta(a).defaultOrder-this._meta(b).defaultOrder||a-b);
        if(fixed.length){const noticeArea=el('div','em-column-notices');column.append(noticeArea);for(const i of fixed){const tile=el('div','em-row'),slot=el('div','em-card');slot.style.gridColumn=`span ${this._defaultWidth(i)}`;slot.append(this._elements[i]);tile.append(slot);noticeArea.append(tile);}}
        const items=this._ordered(col);let row=[],used=0;
        const flush=()=>{if(!row.length)return;const rowEl=el('div','em-row');rowEl.dataset.column=String(col);rowEl.dataset.before=String(row[0]);for(const idx of row){const state=this._state(idx),m=this._meta(idx),tile=el('div','em-tile');tile.style.gridColumn=`span ${state.width}`;tile.dataset.id=m.id;const head=el('div','em-edithead'),grip=el('span','em-grip','⠿');grip.title='Drag this card';grip.draggable=this._editing;head.append(grip,el('span','em-title',m.name));if(!m.required)head.append(button('Hide',()=>this._update(idx,{hidden:true})));const body=el('div','em-card');body.append(this._elements[idx]);tile.append(head,body);
          if(this._editing){const handle=el('div','em-width-handle');handle.title='Drag horizontally to change width';handle.setAttribute('role','separator');handle.setAttribute('aria-label',`Resize ${m.name} horizontally`);tile.append(handle);this._wireResize(handle,tile,idx,col);}
          rowEl.append(tile);
          if(this._editing){grip.addEventListener('dragstart',event=>{this._drag=idx;tile.classList.add('em-dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',m.id);});grip.addEventListener('dragend',()=>{tile.classList.remove('em-dragging');this._drag=null;});}
        }column.append(rowEl);if(this._editing)this._wireDrop(rowEl,col,row[0]);row=[];used=0;};
        for(const i of items){const w=this._state(i).width;if(used+w>12)flush();row.push(i);used+=w;if(used>=12)flush();}flush();if(this._editing){const bottom=el('div','em-drop-end','Drop here to place at bottom of column');column.append(bottom);this._wireDrop(bottom,col,null);}}
      if(this._editing)root.append(el('p','em-hint','Drag ⠿ to move cards; drag the right-edge handle to resize widths. Heights follow content. Reset defaults restores YAML sizes.'));
      this._restoreScroll(scroll);
      // Restore again after HA has laid out the reinserted card elements.
      requestAnimationFrame(()=>this._restoreScroll(scroll));
    }
    _wireResize(handle,tile,i,col){
      handle.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;
        event.preventDefault();event.stopPropagation();
        const row=tile.parentElement, original=this._state(i).width;
        const columnWidth=row.getBoundingClientRect().width;
        if(columnWidth<=0)return;
        const gap=parseFloat(getComputedStyle(row).columnGap)||0;
        const unit=(columnWidth-11*gap)/12+gap;
        if(unit<=0)return;
        const startX=event.clientX;
        let requested=original;
        tile.classList.add('em-resizing');
        handle.setPointerCapture(event.pointerId);
        const move=e=>{
          if(e.pointerId!==event.pointerId)return;
          requested=Math.max(1,Math.min(12,original+Math.round((e.clientX-startX)/unit)));
          // Preview only the resized tile, without rebuilding the HA cards during the gesture.
          tile.style.gridColumn=`span ${requested}`;
          handle.title=`Width: ${requested}/12`;
        };
        const finish=e=>{
          if(e.pointerId!==event.pointerId)return;
          handle.removeEventListener('pointermove',move);
          handle.removeEventListener('pointerup',finish);
          handle.removeEventListener('pointercancel',cancel);
          tile.classList.remove('em-resizing');
          if(requested!==original)this._update(i,{width:requested});
          else tile.style.gridColumn=`span ${original}`;
        };
        const cancel=e=>{if(e.pointerId!==event.pointerId)return;requested=original;finish(e);};
        handle.addEventListener('pointermove',move);
        handle.addEventListener('pointerup',finish);
        handle.addEventListener('pointercancel',cancel);
      });
    }
    _wireDrop(target,col,before){target.addEventListener('dragover',event=>{if(this._drag===null)return;event.preventDefault();event.dataTransfer.dropEffect='move';target.classList.add('em-target');});target.addEventListener('dragleave',()=>target.classList.remove('em-target'));target.addEventListener('drop',event=>{event.preventDefault();target.classList.remove('em-target');const i=this._drag;this._drag=null;if(i===null||i===before)return;this._move(i,col,before);});}
    _move(i,col,before){const all=[0,1,2].map(c=>this._ordered(c,true));for(const arr of all){const at=arr.indexOf(i);if(at!==-1)arr.splice(at,1);}const dest=all[col];const pos=before===null?dest.length:dest.indexOf(before);dest.splice(pos<0?dest.length:pos,0,i);for(let c=0;c<3;c++)all[c].forEach((index,order)=>{const m=this._meta(index);this._layout[m.id]={...this._state(index),col:c,order};});this._render();this._save();}
    _update(i,update){const m=this._meta(i);this._layout[m.id]={...this._state(i),...update};this._render();this._save();}
    async _fetch(){if(!this._hass?.callWS)return;const generation=++this._generation;try{const response=await this._hass.callWS({type:'em_dashboard_layout/get'});if(generation!==this._generation||this._dirty)return;this._rev=response.revision||0;const cards=response.cards||{};this._layout={};for(const [id,s] of Object.entries(cards)){if(Number.isInteger(s.col)&&Number.isInteger(s.order)){this._layout[id]={col:s.col,order:s.order,hidden:s.hidden===true,...(Number.isInteger(s.width)&&s.width>=1&&s.width<=12?{width:s.width}:{})};}else if(s.hidden===true)this._layout[id]={hidden:true};}this._error='';this._render();}catch(e){this._error='Could not load shared layout: '+(e.message||e);this._render();}}
    _payload(){
      const result={};
      for(let i=0;i<this._configs.length;i++){
        const m=this._meta(i);
        if(m.fixed)continue;
        const st=this._state(i);
        result[m.id]={col:st.col,order:st.order,width:st.width,hidden:st.hidden};
      }
      return result;
    }
    async _save(){this._dirty=true;if(this._busy)return;this._busy=true;while(this._dirty){this._dirty=false;try{const result=await this._hass.callWS({type:'em_dashboard_layout/save',cards:this._payload(),revision:this._rev});this._rev=result.revision;this._error='';}catch(e){this._error='Save failed: '+(e.message||e);break;}}this._busy=false;const status=this.querySelector('.em-status');if(status)status.textContent=this._error||'';else if(this._error)this._render();}
  }
  customElements.define(TAG,Layout);
})();
