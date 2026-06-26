if (!window.Eurus.loadedScript.has('quantity-selector.js')) {
  window.Eurus.loadedScript.add('quantity-selector.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xQuantitySelector', (
        productId,
        sectionId,
        qtyRuleMin,
        qtyRuleMax,
        isQtyRule,
        currencyCodeEnable,
        moneyWithCurrency,
        moneyFormat
      ) => ({
        qty: qtyRuleMin,
        min: qtyRuleMin,
        max: qtyRuleMax,
        initQtyChangeEvent(selector) {
          this.$nextTick(() => { 
            this.qty = document.getElementById(selector)?.value;
            document.addEventListener(`eurus:product:quantity-changed-${sectionId}`, (e) => {
              this.qty = e.detail.quantity;
            })
          });
        },
        minus(value) {
          if(this.qty <= this.min) {
            this.qty = this.min;
          } else {
            this.qty = parseInt(this.qty);
            (this.qty == 1) ? this.qty = 1 : this.qty -= value;
          }
          this.updatePrice();
        },
        plus(value) {
          if(this.qty >= this.max && isQtyRule) {
            this.qty = parseInt(this.max);
          } else {
            this.qty = parseInt(this.qty);
            this.qty += value;
          }
          this.updatePrice();
        },
        invalid(el) {
          number = parseFloat(el.value);
          if (!Number.isInteger(number) || number < this.min) {
            this.qty = this.min;
          }
          if (number > this.max && isQtyRule) {
            this.qty = parseInt(this.max);
          }
          this.updatePrice();
        },
        updatePrice() {
          const product_template = document.getElementById(`x-product-template-${productId}-${sectionId}`);
          const money_format = currencyCodeEnable ? moneyWithCurrency : moneyFormat;

          const getPrice = (selector) => {
            return Number(product_template.querySelector(selector).innerHTML) * this.qty;
          };
          const update = (selector, value) => {
            const el = product_template.querySelector(selector);
            if (el) el.innerHTML = value;
          };

          let product_price = Alpine.store('xHelper').formatMoney(getPrice('.target-price'), money_format);
          let product_compare_at_price = Alpine.store('xHelper').formatMoney(getPrice('.target-compare-at-price'), money_format);

          update('.add_to_cart_button .main-product-price .price', product_price);
          update('.add_to_cart_button .main-product-price .price-sale', product_price);
          update('.add_to_cart_button .main-product-price .price-compare', product_compare_at_price);
        }
      }));
    })
  });
}    