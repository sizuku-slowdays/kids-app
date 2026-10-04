class ShapeFillGauge {
  constructor(host, config) { this.host=host; this.config=config; this.renderBase(); }
  format(value){return value>=100?Math.round(value).toLocaleString('ja-JP'):Number(value.toFixed(1)).toString();}
  renderBase() {
    const template=document.querySelector(this.config.templateSelector||'#gaugeTemplate');
    const node=template.content.firstElementChild.cloneNode(true);
    node.style.setProperty('--gauge-color', this.config.color);
    node.dataset.key=this.config.key;
    node.querySelector('.gauge-name').textContent=this.config.label;
    const svg=node.querySelector('svg');
    if(this.config.shapePath)for(const path of svg.querySelectorAll('path'))path.setAttribute('d',this.config.shapePath);
    const clip=svg.querySelector('.person-clip');
    const clipId=`clip-${this.config.key}`;
    clip.id=clipId;
    const layer=svg.querySelector('.fill-layer');
    layer.setAttribute('clip-path', `url(#${clipId})`);
    // Full-height rectangles are scaled from the feet upward.  This is more
    // reliable than animating SVG y/height attributes on iPhone Safari.
    // The planned layer sits behind the opaque current layer, so only the
    // newly added portion remains translucent.
    layer.innerHTML='<rect class="fill-plan" x="0" y="0" width="90" height="150"></rect><g class="stripe-layer"></g><rect class="fill-current" x="0" y="0" width="90" height="150"></rect>';
    node.querySelector('button').addEventListener('click', () => this.config.onSelect?.(this.config.key));
    this.node=node; this.currentRect=node.querySelector('.fill-current'); this.planRect=node.querySelector('.fill-plan');
    this.stripes=node.querySelector('.stripe-layer'); this.value=node.querySelector('.gauge-value');
    this.host.appendChild(node);
    this.node.hidden=!this.config.visible;
  }
  update(current, planned, selected=false) {
    const max=this.config.max;
    const currentRatio=Math.min(current/max,1), totalRatio=Math.min((current+planned)/max,1);
    const currentH=150*currentRatio, totalH=150*totalRatio, planH=Math.max(0,totalH-currentH);
    this.currentRect.style.transform=`scaleY(${currentRatio})`;
    this.planRect.style.transform=`scaleY(${totalRatio})`;
    this.planRect.style.fill=this.config.color; this.planRect.style.opacity='.38';
    this.stripes.replaceChildren();
    const defs=this.node.querySelector('defs');
    let pattern=defs.querySelector('pattern');
    if(!pattern){
      pattern=document.createElementNS('http://www.w3.org/2000/svg','pattern');pattern.id='pattern-'+this.config.key;
      pattern.setAttribute('width','12');pattern.setAttribute('height','12');pattern.setAttribute('patternUnits','userSpaceOnUse');
      pattern.innerHTML='<rect width="12" height="12" fill="'+this.config.color+'"/><path d="M-3 3L3-3M0 12L12 0M9 15L15 9" stroke="white" stroke-width="3"/>';
      defs.append(pattern);
    }
    this.planRect.style.fill=`url(#${pattern.id})`;
    const total=current+planned;
    this.value.textContent=`${this.format(total)} / ${this.format(max)}${this.config.unit}`;
    this.node.title=`現在 ${this.format(current)} · 今回 +${this.format(planned)}${this.config.unit}`;
    this.node.classList.toggle('selected',selected);
    this.node.querySelector('button').setAttribute('aria-label',`${this.config.label} 現在${this.format(current)}、今回${this.format(planned)}、食べたら${this.format(total)}${this.config.unit}`);
  }
}

window.ShapeFillGauge=ShapeFillGauge;
