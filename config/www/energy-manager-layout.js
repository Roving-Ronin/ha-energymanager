/* Energy Manager Layout Manager v7.3.9 */
(() => {
  const TAG = 'energy-manager-layout';
  if (customElements.get(TAG)) return;
  const CSS = `
energy-manager-layout{display:block;min-width:0}energy-manager-layout *{box-sizing:border-box}
energy-manager-layout{display:block;min-width:0}energy-manager-layout *{box-sizing:border-box}
energy-manager-layout .em-tabs{display:flex;flex:1 1 240px;min-width:0;align-items:center;gap:5px;overflow-x:auto;white-space:nowrap;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
energy-manager-layout .em-tabs button{flex-shrink:0}
energy-manager-layout .em-tabs button[aria-selected="true"]{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff);font-weight:600}
energy-manager-layout .em-tabs button:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}
energy-manager-layout .em-toolbar{display:flex;gap:7px;align-items:center;justify-content:flex-end;flex-wrap:nowrap;margin:7px 0 12px;min-width:0}
energy-manager-layout .em-toolbar>button{flex:0 0 auto;white-space:nowrap}
energy-manager-layout .em-editing .em-toolbar{flex-wrap:wrap}
energy-manager-layout .em-profile-select{max-width:180px;min-width:100px;border-radius:6px;padding:5px 6px;background:var(--card-background-color,var(--ha-card-background,#242424));color:var(--primary-text-color);border:1px solid var(--divider-color,#666)}
energy-manager-layout .em-status{font-size:12px;opacity:.75;margin-right:auto}
energy-manager-layout button{font:inherit;background:var(--card-background-color,var(--ha-card-background,#242424));color:var(--primary-text-color);border:1px solid var(--divider-color,#666);border-radius:6px;padding:5px 9px;cursor:pointer}
energy-manager-layout button:disabled{opacity:.4;cursor:default}
energy-manager-layout .em-error{color:var(--error-color,#ef5350);font-size:13px}
energy-manager-layout .em-picker{border:1px solid var(--divider-color,#666);border-radius:9px;padding:12px;margin-bottom:12px}
energy-manager-layout .em-picker-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0}
energy-manager-layout .em-device-tabs{display:flex;gap:4px;background:var(--secondary-background-color,#282828);padding:4px;border-radius:8px}
energy-manager-layout .em-device-tabs button{border:0;background:transparent;border-radius:6px;min-width:80px}
energy-manager-layout .em-device-tabs button[aria-pressed="true"]{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff);font-weight:600}
energy-manager-layout .em-card-search{flex:1 1 180px;max-width:330px;min-width:130px;background:var(--card-background-color,var(--ha-card-background,#242424));border:1px solid var(--divider-color,#666);border-radius:6px;color:var(--primary-text-color);padding:7px 10px;font:inherit}
energy-manager-layout .em-options{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:7px;margin-top:10px}
energy-manager-layout .em-option{display:flex;align-items:center;gap:8px;border:1px solid var(--divider-color,#555);border-radius:7px;padding:9px 10px;min-width:0;cursor:pointer}
energy-manager-layout .em-option[hidden]{display:none}
energy-manager-layout .em-option-name{flex:1;min-width:0;font-size:13px}
energy-manager-layout .em-option input{margin:0;flex-shrink:0}
energy-manager-layout .em-option.em-required{opacity:.7;cursor:default}
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
energy-manager-layout .em-grip.em-locked{cursor:not-allowed;opacity:.35}
energy-manager-layout .em-edithead button.em-locked-button{background:var(--secondary-background-color,#303030);font-weight:600}
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
    constructor(){super();this._config=null;this._configs=[];this._elements=[];this._layout={};this._hass=null;this._rev=0;this._editing=false;this._picker=false;this._catalogueOpen=false;this._pickerDevice='desktop';this._pickerSearch='';this._busy=false;this._dirty=false;this._error='';this._generation=0;this._eligibility='';this._drag=null;this._profiles=[{id:'primary',name:'Overview',cards:{}}];this._activeProfile='primary';this._profileBusy=false;this._histories=new Map();this._historyLimit=40;this._device=this._deviceClass();this._onViewportChange=()=>{const next=this._deviceClass();if(next!==this._device){this._device=next;this._render();}};}
    setConfig(config){this._config=config;this._configs=config.cards||[];this._layout={};this._render();if(this._hass)this._fetch();}
    set cards(cards){const next=cards||[];const changed=next.length!==this._elements.length||next.some((v,i)=>v!==this._elements[i]);this._elements=next;if(changed)this._render();}
    get cards(){return this._elements;}
    set hass(value){const first=!this._hass;const userChanged=this._hass?.user?.id&&value?.user?.id&&this._hass.user.id!==value.user.id;this._hass=value;if(userChanged){this._profiles=[{id:'primary',name:'Overview',cards:{},selected:null}];this._activeProfile='primary';this._layout={};this._generation++;this._histories.clear();}const signature=this._eligibilitySignature();if(signature!==this._eligibility||userChanged)this._render();if((first||userChanged)&&this._config)this._fetch();}
    get hass(){return this._hass;}
    set narrow(value){this._narrow=value;}
    get narrow(){return this._narrow;}
    connectedCallback(){window.addEventListener('resize',this._onViewportChange);this._device=this._deviceClass();this._render();}
    disconnectedCallback(){window.removeEventListener('resize',this._onViewportChange);}
    _deviceClass(){const w=window.innerWidth;return w<=590?'mobile':w<=900?'tablet':'desktop';}
    _deviceHidden(state){return state.locked&&state.lock_device===this._device?false:state.hidden||state.hidden_devices.includes(this._device);}
    _meta(i){const o=this._configs[i]?.view_layout||{};return{id:String(o.em_id||`card-${i}`),name:String(o.em_name||`Card ${i+1}`),fixed:!!o.em_fixed,required:!!o.em_required&&this._activeProfile==='primary',defaultTab:String(o.em_default_tab||'overview'),defaultColumn:Math.max(0,Math.min(2,Number(o.em_column??i%3))),defaultOrder:Number(o.em_order??i)};}
    _conditionsMatch(conditions){if(!Array.isArray(conditions)||!this._hass?.states)return false;return conditions.every(rule=>{const state=this._hass.states[rule.entity]?.state;if(state===undefined)return false;const values=v=>(Array.isArray(v)?v:[v]).map(String);return(rule.state===undefined||values(rule.state).includes(state))&&(rule.state_not===undefined||!values(rule.state_not).includes(state));});}
    _eligible(i){const card=this._configs[i];return card?.type!=='conditional'||!Array.isArray(card.conditions)||this._conditionsMatch(card.conditions);}
    _placeableInactive(i){return ['energy-control-timer','demand-period-active-notification'].includes(this._meta(i).id);}
    _catalogueEligible(i){const card=this._configs[i],v=card?.view_layout||{};if(v.em_fixed||v.em_duplicate_of||v.em_companion_of)return false;if(Array.isArray(v.em_picker_conditions))return this._conditionsMatch(v.em_picker_conditions);return this._placeableInactive(i)||this._eligible(i);}
    _eligibilitySignature(){return this._configs.map((_,i)=>(this._eligible(i)?'1':'0')+(this._catalogueEligible(i)?'1':'0')).join('');}
    _defaultWidth(i){const v=Number(this._configs[i]?.view_layout?.em_width);return Number.isInteger(v)?Math.max(1,Math.min(12,v)):12;}
    _inverterCardIds(){return new Set(this._configs.map(c=>c.view_layout||{}).filter(v=>v.em_default_tab==='inverter').map(v=>v.em_duplicate_of||v.em_id).filter(Boolean));}
    _state(i){const m=this._meta(i),s=this._layout[m.id]||{};const col=Number.isInteger(s.col)?s.col:m.defaultColumn;const order=Number.isInteger(s.order)?s.order:m.defaultOrder;const inverterDefault=this._activeProfile==='inverter'&&this._inverterCardIds().has(m.id);return{col:Math.max(0,Math.min(2,col)),order, width:(Number.isInteger(s.width)&&s.width>=1&&s.width<=12?s.width:this._defaultWidth(i)),hidden:!m.required&&(typeof s.hidden==='boolean'?s.hidden:(inverterDefault?false:this._configs[i]?.view_layout?.em_hidden===true)),hidden_devices:!m.required&&Array.isArray(s.hidden_devices)?s.hidden_devices.filter(v=>['desktop','tablet','mobile'].includes(v)):[],locked:typeof s.locked==='boolean'?s.locked:this._configs[i]?.view_layout?.em_locked===true,lock_device:['desktop','tablet','mobile'].includes(s.lock_device)?s.lock_device:null};}
    _selectedIds(tab){
      const canonical=new Map(this._configs.map(c=>[c.view_layout?.em_id,c.view_layout?.em_duplicate_of||c.view_layout?.em_id]));
      if(Array.isArray(tab?.selected))return new Set(tab.selected.map(id=>canonical.get(id)||id));
      const ids=new Set();
      const inverterIds=this._inverterCardIds();
      for(let i=0;i<this._configs.length;i++){
        const meta=this._meta(i),v=this._configs[i]?.view_layout||{};
        if(v.em_fixed||v.em_companion_of||v.em_duplicate_of)continue;
        if(tab?.id==='primary'&&meta.defaultTab!=='inverter')ids.add(meta.id);
        else if(tab?.id==='inverter'&&(inverterIds.has(meta.id)||Object.prototype.hasOwnProperty.call(tab.cards||{},meta.id)))ids.add(meta.id);
        else if(tab?.id!=='primary'&&tab?.id!=='inverter')ids.add(meta.id);
      }
      return ids;
    }
    _normaliseTabs(tabs){
      const aliases=new Map(this._configs.map(c=>[c.view_layout?.em_id,c.view_layout?.em_duplicate_of]).filter(([,target])=>!!target));
      for(const tab of tabs){
        if(Array.isArray(tab.selected))tab.selected=[...new Set(tab.selected.map(id=>aliases.get(id)||id))];
        for(const [oldId,target] of aliases){if(Object.prototype.hasOwnProperty.call(tab.cards||{},oldId)){
          if(!Object.prototype.hasOwnProperty.call(tab.cards,target))tab.cards[target]=tab.cards[oldId];
          delete tab.cards[oldId];
        }}
      }
      return tabs;
    }
    _eligibleItems(){const tab=this._profiles.find(t=>t.id===this._activeProfile),selected=this._selectedIds(tab);return this._configs.map((_,i)=>i).filter(i=>this._catalogueEligible(i)&&selected.has(this._meta(i).id)&&(this._eligible(i)||(this._editing&&this._placeableInactive(i))));}
    _ordered(col,includeHidden=false){return this._eligibleItems().filter(i=>{const s=this._state(i);return s.col===col&&(includeHidden||!this._deviceHidden(s));}).sort((a,b)=>this._state(a).order-this._state(b).order||a-b);}
    _history(){
      if(!this._histories.has(this._activeProfile))this._histories.set(this._activeProfile,{undo:[],redo:[]});
      return this._histories.get(this._activeProfile);
    }
    _snapshot(){return JSON.stringify(this._layout);}
    _record(before){
      const after=this._snapshot();
      if(after===before)return false;
      const history=this._history();
      history.undo.push(before);
      if(history.undo.length>this._historyLimit)history.undo.shift();
      history.redo=[];
      return true;
    }
    _travel(direction){
      if(this._profileBusy)return;
      const history=this._history();
      const from=direction==='undo'?history.undo:history.redo;
      const to=direction==='undo'?history.redo:history.undo;
      if(!from.length)return;
      to.push(this._snapshot());
      if(to.length>this._historyLimit)to.shift();
      this._layout=JSON.parse(from.pop());
      this._render();
      this._save();
    }
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
      const tabs=el('div','em-tabs');tabs.setAttribute('role','tablist');
      for(const tab of this._profiles){
        const item=button(tab.name,()=>this._switchTab(tab.id));
        item.setAttribute('role','tab');item.setAttribute('aria-selected',String(tab.id===this._activeProfile));
        item.disabled=this._busy||this._profileBusy;tabs.append(item);
      }
      toolbar.append(tabs);
      if(this._editing){
        const add=button('＋ New tab',()=>{const name=prompt('Name for the new tab:');if(name?.trim())this._profileAction('create',{name:name.trim()});});
        add.disabled=this._profiles.length>=8;toolbar.append(add);
        toolbar.append(button('✎ Rename tab',()=>{const current=this._profiles.find(p=>p.id===this._activeProfile);const name=prompt('Rename tab:',current?.name||'');if(name?.trim())this._profileAction('rename',{name:name.trim()});}));
        const remove=button('✕ Delete tab',()=>{if(confirm('Delete this tab?'))this._profileAction('delete',{});});
        remove.disabled=this._activeProfile==='primary';toolbar.append(remove);
        toolbar.append(button('← Move tab',()=>this._profileAction('move',{offset:-1})));
        toolbar.append(button('Move tab →',()=>this._profileAction('move',{offset:1})));
        const exportBtn=button('↓ Export layout',()=>this._exportLayout());
        exportBtn.disabled=this._busy||this._profileBusy;toolbar.append(exportBtn);
        const fileInput=el('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.style.display='none';
        fileInput.addEventListener('change',async()=>{const file=fileInput.files?.[0];fileInput.value='';if(file)await this._importLayout(file);});
        toolbar.append(fileInput);
        const importBtn=button('↑ Import layout',()=>fileInput.click());
        importBtn.disabled=this._busy||this._profileBusy;toolbar.append(importBtn);
      }
      const customise=button(this._editing?'✓ Finish customising':'✥ Customise',()=>{this._editing=!this._editing;this._render();});toolbar.append(customise);
      toolbar.append(button('☷ Show / hide',()=>{this._picker=!this._picker;this._render();}));
      if(this._editing){
        const history=this._history();
        const undo=button('↶ Undo',()=>this._travel('undo'));undo.disabled=!history.undo.length||this._profileBusy;toolbar.append(undo);
        const redo=button('↷ Redo',()=>this._travel('redo'));redo.disabled=!history.redo.length||this._profileBusy;toolbar.append(redo);
        toolbar.append(button('↺ Reset defaults',()=>{if(this._profileBusy)return;if(confirm('Restore the default arrangement and visibility of all optional cards?')){const before=this._snapshot();this._layout={};if(this._record(before)){this._render();this._save();}}}));
        toolbar.append(button('⟳ Reload saved',()=>{if(this._busy||this._profileBusy)return;this._dirty=false;this._histories.delete(this._activeProfile);this._fetch();}));
      }
      if(this._picker){
        const panel=el('div','em-picker');panel.append(el('strong','','Show / hide'));
        panel.append(el('p','em-hint','Tick a card to show it on this tab for the selected device. Untick to hide it. Inactive warnings remain available for positioning while customising.'));
        const controls=el('div','em-picker-toolbar'),tabs=el('div','em-device-tabs');
        const currentDevice=this._pickerDevice;
        for(const device of ['desktop','tablet','mobile']){
          const tab=button(device.charAt(0).toUpperCase()+device.slice(1),()=>{this._pickerDevice=device;this._render();});
          tab.setAttribute('aria-pressed',String(device===currentDevice));
          tabs.append(tab);
        }
        controls.append(tabs);
        const search=el('input','em-card-search');search.type='search';search.placeholder='Search cards…';search.setAttribute('aria-label','Search cards');search.value=this._pickerSearch;
        controls.append(search);panel.append(controls);
        const options=el('div','em-options'),entries=[];
        const activeTab=this._profiles.find(t=>t.id===this._activeProfile);
        const selected=this._selectedIds(activeTab);
        for(let i=0;i<this._configs.length;i++){
          if(!this._catalogueEligible(i))continue;
          const m=this._meta(i),state=this._state(i),opt=el('label','em-option'),input=el('input');
          const included=selected.has(m.id);
          const visible=included&&(m.required||(state.locked&&state.lock_device===currentDevice)||(!state.hidden&&!state.hidden_devices.includes(currentDevice)));
          input.type='checkbox';input.checked=visible;
          input.disabled=m.required||(included&&state.locked&&state.lock_device===currentDevice);
          input.title='Show on '+currentDevice;input.setAttribute('aria-label','Show '+m.name+' on '+currentDevice);
          input.addEventListener('change',()=>{
            if(m.required||(included&&this._state(i).locked&&this._state(i).lock_device===currentDevice))return;
            const all=['desktop','tablet','mobile'];
            if(!selected.has(m.id)){
              if(!input.checked)return;
              selected.add(m.id);
              activeTab.selected=[...selected];
              this._layout[m.id]={...this._state(i),hidden:false,hidden_devices:all.filter(d=>d!==currentDevice)};
              this._render();this._save();
              return;
            }
            const latest=this._state(i);
            let hiddenDevices=latest.hidden?all.filter(d=>d!==currentDevice):[...latest.hidden_devices];
            if(input.checked)hiddenDevices=hiddenDevices.filter(d=>d!==currentDevice);
            else if(!hiddenDevices.includes(currentDevice))hiddenDevices.push(currentDevice);
            this._update(i,{hidden:false,hidden_devices:hiddenDevices},currentDevice);
          });
          opt.append(input,el('span','em-option-name',m.name+(m.required?' (required on primary)':'')));
          options.append(opt);entries.push({opt,name:m.name.toLocaleLowerCase()});
        }
        const filter=()=>{const q=this._pickerSearch.trim().toLocaleLowerCase();for(const entry of entries)entry.opt.hidden=!!q&&!entry.name.includes(q);};
        search.addEventListener('input',()=>{this._pickerSearch=search.value;filter();});filter();
        panel.append(options);root.append(panel);
      }
      const columns=el('div','em-columns');root.append(columns);for(let col=0;col<3;col++){const column=el('div','em-column');column.dataset.column=String(col);columns.append(column);
        const fixed=this._configs.map((_,i)=>i).filter(i=>{const m=this._meta(i);return m.fixed&&m.defaultColumn===col&&this._eligible(i);}).sort((a,b)=>this._meta(a).defaultOrder-this._meta(b).defaultOrder||a-b);
        if(fixed.length){const noticeArea=el('div','em-column-notices');column.append(noticeArea);for(const i of fixed){const tile=el('div','em-row'),slot=el('div','em-card');slot.style.gridColumn=`span ${this._defaultWidth(i)}`;slot.append(this._elements[i]);tile.append(slot);noticeArea.append(tile);}}
        const items=this._ordered(col);let row=[],used=0;
        const flush=()=>{if(!row.length)return;const rowEl=el('div','em-row');rowEl.dataset.column=String(col);rowEl.dataset.before=String(row[0]);for(const idx of row){const state=this._state(idx),m=this._meta(idx),tile=el('div','em-tile');tile.style.gridColumn=`span ${state.width}`;tile.dataset.id=m.id;const head=el('div','em-edithead'),grip=el('span','em-grip','⠿');grip.title=state.locked?'Unlock this card to move it':'Drag this card';grip.draggable=this._editing&&!state.locked;if(state.locked)grip.classList.add('em-locked');head.append(grip,el('span','em-title',m.name));if(this._editing){const lock=button(state.locked?'🔒 Locked':'🔓 Lock',()=>this._update(idx,{locked:!this._state(idx).locked,lock_device:this._state(idx).locked?null:this._device}));lock.title=state.locked?'Allow this card to be moved or resized':'Prevent moving and resizing this card';if(state.locked)lock.classList.add('em-locked-button');head.append(lock);}if(!m.required&&!(state.locked&&state.lock_device===this._device))head.append(button('Hide',()=>this._hideOnCurrentDevice(idx)));const body=el('div','em-card');body.append(this._elements[idx]);const companion=this._configs.findIndex(c=>c.view_layout?.em_companion_of===m.id);if(companion>=0)body.append(this._elements[companion]);tile.append(head,body);
          if(this._editing&&!state.locked){const handle=el('div','em-width-handle');handle.title='Drag horizontally to change width';handle.setAttribute('role','separator');handle.setAttribute('aria-label',`Resize ${m.name} horizontally`);tile.append(handle);this._wireResize(handle,tile,idx,col);}
          rowEl.append(tile);
          if(this._editing&&!state.locked){grip.addEventListener('dragstart',event=>{this._drag=idx;tile.classList.add('em-dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',m.id);});grip.addEventListener('dragend',()=>{tile.classList.remove('em-dragging');this._drag=null;});}
        }column.append(rowEl);if(this._editing)this._wireDrop(rowEl,col,row[0]);row=[];used=0;};
        for(const i of items){const w=this._state(i).width;if(used+w>12)flush();row.push(i);used+=w;if(used>=12)flush();}flush();if(this._editing){const bottom=el('div','em-drop-end','Drop here to place at bottom of column');column.append(bottom);this._wireDrop(bottom,col,null);}}
      if(this._editing)root.append(el('p','em-hint','Drag ⠿ to move cards; drag the right-edge handle to resize widths. Lock a card to protect its position and width; unlock it to edit. Undo and Redo apply to this profile only (up to 40 steps). Heights follow content.'));
      this._restoreScroll(scroll);
      // Restore again after HA has laid out the reinserted card elements.
      requestAnimationFrame(()=>this._restoreScroll(scroll));
    }
    _wireResize(handle,tile,i,col){
      handle.addEventListener('pointerdown',event=>{
        if(event.button!==0||this._state(i).locked)return;
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
    _wireDrop(target,col,before){target.addEventListener('dragover',event=>{if(this._drag===null||this._state(this._drag).locked)return;event.preventDefault();event.dataTransfer.dropEffect='move';target.classList.add('em-target');});target.addEventListener('dragleave',()=>target.classList.remove('em-target'));target.addEventListener('drop',event=>{event.preventDefault();target.classList.remove('em-target');const i=this._drag;this._drag=null;if(i===null||i===before||this._state(i).locked)return;this._move(i,col,before);});}
    _move(i,col,before){if(this._profileBusy||this._state(i).locked)return;const snapshot=this._snapshot();const all=[0,1,2].map(c=>this._ordered(c,true));for(const arr of all){const at=arr.indexOf(i);if(at!==-1)arr.splice(at,1);}const dest=all[col];const pos=before===null?dest.length:dest.indexOf(before);dest.splice(pos<0?dest.length:pos,0,i);for(let c=0;c<3;c++){const previous=this._ordered(c,true).filter(idx=>this._state(idx).locked);for(const lockedIdx of previous){if(all[c].indexOf(lockedIdx)!==this._ordered(c,true).indexOf(lockedIdx))return;}}for(let c=0;c<3;c++)all[c].forEach((index,order)=>{const m=this._meta(index);this._layout[m.id]={...this._state(index),col:c,order};});if(this._record(snapshot)){this._render();this._save();}}
    _hideOnCurrentDevice(i){const st=this._state(i);if(st.locked&&st.lock_device===this._device)return;const all=['desktop','tablet','mobile'];const hiddenDevices=st.hidden?all.filter(d=>d!==this._device):[...st.hidden_devices];if(!hiddenDevices.includes(this._device))hiddenDevices.push(this._device);this._update(i,{hidden:false,hidden_devices:hiddenDevices});}
    _update(i,update,visibilityDevice=this._device){if(this._profileBusy||this._state(i).locked&&('width' in update||'col' in update||'order' in update))return;if(this._state(i).locked&&this._state(i).lock_device===visibilityDevice&&('hidden' in update||'hidden_devices' in update))return;const snapshot=this._snapshot();const m=this._meta(i);const next={...this._state(i),...update};if(update.locked===true){const current=this._device;const all=['desktop','tablet','mobile'];next.hidden_devices=next.hidden?all.filter(d=>d!==current):[...next.hidden_devices];next.hidden=false;next.hidden_devices=next.hidden_devices.filter(d=>d!==current);}if(next.locked&&next.lock_device){next.hidden_devices=next.hidden_devices.filter(d=>d!==next.lock_device);}
      this._layout[m.id]=next;if(this._record(snapshot)){this._render();this._save();}}
    _migrationSpecs(){
      const specs=[];
      for(let i=0;i<this._configs.length;i++){
        const m=this._meta(i),v=this._configs[i]?.view_layout||{};
        if(m.fixed)continue;
        const aliases=[...(Array.isArray(v.em_previous_ids)?v.em_previous_ids:[]),...(typeof v.em_previous_id==='string'?[v.em_previous_id]:[])];
        specs.push({id:m.id,col:m.defaultColumn,order:Math.max(0,Math.min(1000,Math.trunc(m.defaultOrder)||0)),width:this._defaultWidth(i),hidden:!m.required&&v.em_hidden===true,hidden_devices:[],required:m.required,locked:v.em_locked===true,aliases:[...new Set(aliases.filter(a=>typeof a==='string'&&a!==m.id))]});
      }
      return specs;
    }
    _switchTab(id){
      if(this._busy||this._profileBusy||id===this._activeProfile)return;
      const tab=this._profiles.find(t=>t.id===id);if(!tab)return;
      this._activeProfile=id;this._layout=structuredClone(tab.cards||{});this._picker=false;this._catalogueOpen=false;this._render();
    }
    async _fetch(){if(!this._hass?.callWS)return;const generation=++this._generation;try{
      const response=await this._hass.callWS({type:'em_dashboard_tabs/get'});
      if(generation!==this._generation||this._dirty)return;
      this._rev=response.revision||0;
      this._profiles=this._normaliseTabs(Array.isArray(response.tabs)?response.tabs:[]);
      this._activeProfile=this._profiles[0]?.id||'primary';
      this._layout=structuredClone(this._profiles.find(t=>t.id===this._activeProfile)?.cards||{});
      this._histories.clear();this._error='';this._render();
    }catch(e){this._error='Could not load user tabs: '+(e.message||e);this._render();}}
    async _profileAction(action,params){
      if(this._busy||this._profileBusy)return;
      const previous=structuredClone(this._profiles);
      const oldId=this._activeProfile;
      const active=this._profiles.find(t=>t.id===this._activeProfile);
      if(!active)return;
      if(action==='create'){
        if(this._profiles.length>=8)return;
        const name=params.name?.trim();if(!name||name.length>50)return;
        const id='tab-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
        const cards={};for(let i=0;i<this._configs.length;i++){
          const m=this._meta(i);if(!m.fixed)cards[m.id]={col:m.defaultColumn,order:m.defaultOrder,width:this._defaultWidth(i),hidden:true,hidden_devices:[],locked:false,lock_device:null};
        }
        this._profiles.push({id,name,cards,selected:[]});this._activeProfile=id;this._layout=structuredClone(cards);
      }else if(action==='rename'){
        const name=params.name?.trim();if(!name||name.length>50)return;active.name=name;
      }else if(action==='delete'){
        if(active.id==='primary')return;
        this._profiles=this._profiles.filter(t=>t.id!==active.id);
        this._activeProfile=this._profiles[0].id;this._layout=structuredClone(this._profiles[0].cards);
      }else if(action==='move'){
        const index=this._profiles.indexOf(active),dest=index+params.offset;
        if(dest<0||dest>=this._profiles.length)return;
        this._profiles.splice(index,1);this._profiles.splice(dest,0,active);
      }else return;
      this._render();
      try{await this._save();}
      catch(e){this._profiles=previous;this._activeProfile=oldId;this._layout=structuredClone(previous.find(t=>t.id===oldId)?.cards||{});this._error='Tab change failed: '+(e.message||e);this._render();}
    }
    _exportLayout(){
      if(this._busy||this._profileBusy){this._error='Finish saving the layout before exporting.';this._render();return;}
      const name=this._profiles.find(p=>p.id===this._activeProfile)?.name||'Overview';
      const data={format:'energy-manager-layout-profile',version:1,name,cards:this._payload()};
      const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const link=el('a');
      const safe=name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50)||'layout';
      link.href=url;link.download=`energy-manager-layout-${safe}.json`;
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    async _importLayout(file){
      if(this._busy||this._profileBusy){this._error='Finish saving the current layout before importing.';this._render();return;}
      try{
        if(file.size>150000)throw new Error('File is too large (150 KB maximum).');
        const data=JSON.parse(await file.text());
        if(!data||Array.isArray(data)||typeof data!=='object'||data.format!=='energy-manager-layout-profile'||data.version!==1||!data.cards||Array.isArray(data.cards)||typeof data.cards!=='object')
          throw new Error('Not a supported Energy Manager layout export (format version 1).');
        if(Object.keys(data.cards).length>500)throw new Error('Too many cards in layout file.');
        const known=new Map(this._configs.map((_,i)=>[this._meta(i).id,this._meta(i)]));
        const cards={};let ignored=0;
        for(const [id,value] of Object.entries(data.cards)){
          const meta=known.get(id);
          if(!meta||meta.fixed){ignored++;continue;}
          if(!value||Array.isArray(value)||typeof value!=='object'||(value.locked!==undefined&&typeof value.locked!=='boolean')||
             !Number.isInteger(value.col)||value.col<0||value.col>2||
             !Number.isInteger(value.order)||value.order<0||value.order>1000||
             !Number.isInteger(value.width)||value.width<1||value.width>12||
             typeof value.hidden!=='boolean'||(value.hidden_devices!==undefined&&(!Array.isArray(value.hidden_devices)||value.hidden_devices.some(v=>!['desktop','tablet','mobile'].includes(v)))))
            throw new Error(`Invalid position, width or visibility for card: ${id}`);
          cards[id]={col:value.col,order:value.order,width:value.width,hidden:meta.required?false:value.hidden,hidden_devices:meta.required?[]:[...new Set(value.hidden_devices||[])],locked:value.locked===true,lock_device:['desktop','tablet','mobile'].includes(value.lock_device)?value.lock_device:null};
        }
        if(!Object.keys(cards).length)throw new Error('No compatible cards were found in this layout.');
        const suggested=String(data.name||'Imported layout').slice(0,50);
        const input=prompt(`Import ${Object.keys(cards).length} cards as a new profile${ignored?` (${ignored} unavailable/fixed cards ignored)`:''}.\nName for the imported profile:`,suggested);
        if(input===null)return;
        const name=input.trim();
        if(!name||name.length>50)throw new Error('Profile name must be 1–50 characters.');
        // Only matched IDs are included. Any cards added later use their YAML defaults.
        if(this._profiles.length>=8)throw new Error('Maximum of eight tabs reached.');
        const id='tab-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
        const previous=structuredClone(this._profiles),oldId=this._activeProfile;
        this._profiles.push({id,name,cards,selected:Object.keys(cards)});
        this._activeProfile=id;this._layout=structuredClone(cards);
        try{await this._save();}
        catch(error){
          this._profiles=previous;this._activeProfile=oldId;
          this._layout=structuredClone(previous.find(t=>t.id===oldId)?.cards||{});
          throw error;
        }
        this._render();
      }catch(e){this._error='Import failed: '+(e.message||e);this._render();}
    }
    _payload(){
      const result={};
      for(let i=0;i<this._configs.length;i++){
        const m=this._meta(i);
        if(m.fixed)continue;
        const st=this._state(i);
        result[m.id]={col:st.col,order:st.order,width:st.width,hidden:st.hidden,hidden_devices:st.hidden_devices,locked:st.locked,lock_device:st.lock_device};
      }
      return result;
    }
    async _save(){this._dirty=true;if(this._busy)return;this._busy=true;let failure=null;while(this._dirty){this._dirty=false;try{const current=this._profiles.find(t=>t.id===this._activeProfile);if(current)current.cards=this._payload();const result=await this._hass.callWS({type:'em_dashboard_tabs/save',tabs:this._profiles,revision:this._rev});this._rev=result.revision;this._error='';}catch(e){failure=e;this._error='Save failed: '+(e.message||e);break;}}this._busy=false;const status=this.querySelector('.em-status');if(status)status.textContent=this._error||'';else if(this._error)this._render();if(failure)throw failure;}
  }
  customElements.define(TAG,Layout);
})();
