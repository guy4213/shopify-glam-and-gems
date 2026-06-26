if (!window.Eurus.loadedScript.has('preview-color-swatches.js')) {
  window.Eurus.loadedScript.add('preview-color-swatches.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xProductCard', (
        sectionId,
        productUrl,
        productId,
      ) => ({
        isSelect: false,
        productId: productId,
        showOptions: false,
        init() {          
          document.addEventListener(`eurus:product-card-variant-select:updated:${sectionId}`, (e) => {
            this.checkVariantSelected();
          });
        },
        checkVariantSelected() {
          const fieldset = [...document.querySelectorAll(`#variant-update-${sectionId} fieldset`)];
          if(fieldset.findIndex(item => !item.querySelector("input:checked")) == "-1") {
            this.isSelect = true;
          }
        }
      }));
    })
  });
}    