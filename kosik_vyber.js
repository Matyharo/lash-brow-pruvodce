// Shoptet - Uživatelsky přívětivý manuální výběr dopravy a platby v 1. kroku košíku
(function () {
  'use strict';

  // Spustit pouze v 1. kroku objednávky a zamezit duplicitní inicializaci
  if (location.pathname !== '/objednavka/krok-1/' || window.shoptetManualChoiceActive) return;
  window.shoptetManualChoiceActive = true;

  // Vložení moderních a přehledných CSS stylů
  var style = document.createElement('style');
  style.id = 'shoptet-manual-choice-style';
  style.textContent = [
    '/* Styly pro informační a chybové hlášky */',
    '.shoptet-choice-note {',
    '  margin: 8px 0 14px;',
    '  padding: 10px 14px;',
    '  border-radius: 6px;',
    '  font-size: 13.5px;',
    '  line-height: 1.45;',
    '  transition: all 0.2s ease;',
    '}',
    '.shoptet-choice-note.note-info {',
    '  background: #f0f7ff;',
    '  border: 1px solid #c8e1ff;',
    '  color: #1e5bb8;',
    '}',
    '.shoptet-choice-note.note-error {',
    '  background: #fdf2f2;',
    '  border: 1px solid #f8b4b4;',
    '  color: #c81e1e;',
    '  font-weight: 600;',
    '  animation: shoptetNotePulse 0.35s ease;',
    '}',
    '@keyframes shoptetNotePulse {',
    '  0% { transform: scale(0.98); opacity: 0.8; }',
    '  50% { transform: scale(1.01); }',
    '  100% { transform: scale(1); opacity: 1; }',
    '}',
    '/* Vizuální uzamčení sekce plateb, dokud není vybrána doprava */',
    '#order-billing-methods.shoptet-billing-locked {',
    '  opacity: 0.6;',
    '  transition: opacity 0.25s ease;',
    '}',
    '#order-billing-methods.shoptet-billing-locked .radio-wrapper {',
    '  cursor: not-allowed;',
    '}',
    '/* Skrytí souhrnu ceny dopravy a platby, dokud není kompletní výběr */',
    '#order-form.shoptet-choice-pending #shipping-billing-summary {',
    '  display: none !important;',
    '}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(style);

  // Stav vybraných hodnot uživatelem
  // null = uživatel zatím nic manuálně nezvolil (musí zůstat neodznačeno)
  var userShippingId = null;
  var userBillingId = null;

  function getForm() {
    return document.getElementById('order-form');
  }

  function isAvailable(radio) {
    if (!radio || radio.disabled) return false;
    var row = radio.closest('.radio-wrapper');
    if (row && (row.classList.contains('inactive-child') || row.style.display === 'none')) {
      return false;
    }
    return true;
  }

  // Zobrazení nebo aktualizace textové zprávy u daného bloku
  function setNote(containerSelector, noteId, text, type) {
    var container = document.querySelector(containerSelector);
    if (!container) return;

    var el = document.getElementById(noteId);
    if (!text) {
      if (el) el.remove();
      return;
    }

    if (!el) {
      el = document.createElement('div');
      el.id = noteId;
      el.setAttribute('aria-live', 'polite');
      container.parentNode.insertBefore(el, container);
    }

    el.className = 'shoptet-choice-note ' + (type === 'error' ? 'note-error' : 'note-info');
    el.textContent = text;
  }

  // Plynulé odscrolování k chybějícímu kroku a zaměření
  function scrollToSection(selector) {
    var section = document.querySelector(selector);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var firstRadio = section.querySelector('input[type="radio"]:not(:disabled)');
    if (firstRadio) {
      try { firstRadio.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  // Jádro řízení stavu: vynucení manuální volby a zobrazení UI
  function enforceManualChoice(showValidationErrors) {
    var form = getForm();
    if (!form) return;

    var shippingRadios = document.querySelectorAll('#order-shipping-methods input[type="radio"][name="shippingId"]');
    var billingRadios = document.querySelectorAll('#order-billing-methods input[type="radio"][name="billingId"]');
    var billingSection = document.querySelector('#order-billing-methods');

    // 1. ŘÍZENÍ DOPRAVY
    if (userShippingId === null) {
      // Uživatel ještě dopravu nezvolil -> odznačit veškeré předvybrané
      shippingRadios.forEach(function (radio) {
        radio.checked = false;
        var row = radio.closest('.radio-wrapper');
        if (row) row.classList.remove('active');
      });
      var shipText = 'Vyberte prosím způsob dopravy.';
      var shipType = showValidationErrors ? 'error' : 'info';
      setNote('#order-shipping-methods', 'shoptet-shipping-note', shipText, shipType);
    } else {
      // Uživatel již dopravu zvolil -> zajistit, že vybraná je POUZE jeho volba
      shippingRadios.forEach(function (radio) {
        if (radio.value === userShippingId) {
          radio.checked = true;
          var row = radio.closest('.radio-wrapper');
          if (row) row.classList.add('active');
        } else {
          radio.checked = false;
          var row = radio.closest('.radio-wrapper');
          if (row) row.classList.remove('active');
        }
      });
      setNote('#order-shipping-methods', 'shoptet-shipping-note', '', '');
    }

    // 2. ŘÍZENÍ PLATBY
    if (userShippingId === null) {
      // Bez dopravy jsou platby zamčené a odznačené
      userBillingId = null;
      billingRadios.forEach(function (radio) {
        radio.checked = false;
        var row = radio.closest('.radio-wrapper');
        if (row) row.classList.remove('active');
      });
      if (billingSection) billingSection.classList.add('shoptet-billing-locked');
      setNote('#order-billing-methods', 'shoptet-billing-note', 'Způsob platby zvolte po výběru dopravy.', 'info');
    } else {
      // Doprava je vybrána -> platby odemčeny
      if (billingSection) billingSection.classList.remove('shoptet-billing-locked');

      if (userBillingId === null) {
        // Platba ještě nebyla vybrána -> odznačit vše
        billingRadios.forEach(function (radio) {
          radio.checked = false;
          var row = radio.closest('.radio-wrapper');
          if (row) row.classList.remove('active');
        });
        var billText = showValidationErrors
          ? 'Vyberte prosím způsob platby.'
          : 'Nyní prosím vyberte způsob platby.';
        var billType = showValidationErrors ? 'error' : 'info';
        setNote('#order-billing-methods', 'shoptet-billing-note', billText, billType);
      } else {
        // Platba je vybrána -> ověřit dostupnost pro novou dopravu
        var chosenBillingRadio = Array.from(billingRadios).find(function (r) {
          return r.value === userBillingId;
        });

        if (chosenBillingRadio && isAvailable(chosenBillingRadio)) {
          billingRadios.forEach(function (radio) {
            if (radio.value === userBillingId) {
              radio.checked = true;
              var row = radio.closest('.radio-wrapper');
              if (row) row.classList.add('active');
            } else {
              radio.checked = false;
              var row = radio.closest('.radio-wrapper');
              if (row) row.classList.remove('active');
            }
          });
          setNote('#order-billing-methods', 'shoptet-billing-note', '', '');
        } else {
          // Platba již není pro tuto dopravu dostupná -> resetovat platbu
          userBillingId = null;
          billingRadios.forEach(function (radio) {
            radio.checked = false;
            var row = radio.closest('.radio-wrapper');
            if (row) row.classList.remove('active');
          });
          setNote('#order-billing-methods', 'shoptet-billing-note', 'Zvolte prosím způsob platby pro vybranou dopravu.', 'info');
        }
      }
    }

    // 3. SOUHRN CENY
    var isPending = (userShippingId === null) || (userBillingId === null);
    form.classList.toggle('shoptet-choice-pending', isPending);

    var summarySection = document.querySelector('#shipping-billing-summary');
    if (summarySection) {
      setNote('#shipping-billing-summary', 'shoptet-summary-note', isPending ? 'Cena za dopravu a platbu se započítá po jejich výběru.' : '', 'info');
    }
  }

  // Ošetření pokusu o pokračování / odeslání objednávky
  function handleFormSubmitAttempt(event) {
    if (userShippingId === null) {
      if (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      enforceManualChoice(true);
      setNote('#order-shipping-methods', 'shoptet-shipping-note', 'Vyberte prosím způsob dopravy.', 'error');
      scrollToSection('#order-shipping-methods');
      return false;
    }

    if (userBillingId === null) {
      if (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      enforceManualChoice(true);
      setNote('#order-billing-methods', 'shoptet-billing-note', 'Vyberte prosím způsob platby.', 'error');
      scrollToSection('#order-billing-methods');
      return false;
    }

    return true;
  }

  // Zachycení události CHANGE z radio přepínačů
  document.addEventListener('change', function (event) {
    var target = event.target;
    if (!target || !(target instanceof Element)) return;

    // Volba dopravy
    if (target.matches('input[type="radio"][name="shippingId"]')) {
      userShippingId = target.value;
      enforceManualChoice(false);
      return;
    }

    // Volba platby
    if (target.matches('input[type="radio"][name="billingId"]')) {
      if (userShippingId !== null) {
        userBillingId = target.value;
        enforceManualChoice(false);
      }
      return;
    }

    // Změna země doručení nebo měny -> vyresetovat pro nový výběr
    if (target.id === 'deliveryCountryId' || target.id === 'payment-currency') {
      userShippingId = null;
      userBillingId = null;
      enforceManualChoice(false);
      return;
    }
  });

  // Zachycení kliknutí na řádky, zamčené platby a tlačítko dalšího kroku
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !(target instanceof Element)) return;

    // 1. Tlačítko dalšího kroku objednávky
    if (target.closest('.js-orderFormSubmit, [data-testid="buttonNextStep"]')) {
      handleFormSubmitAttempt(event);
      return;
    }

    // 2. Kliknutí do sekce plateb, když ještě není vybrána doprava
    var billingSection = document.querySelector('#order-billing-methods');
    if (billingSection && billingSection.contains(target)) {
      if (userShippingId === null) {
        event.preventDefault();
        event.stopPropagation();
        setNote('#order-shipping-methods', 'shoptet-shipping-note', 'Nejprve prosím vyberte způsob dopravy výše.', 'error');
        scrollToSection('#order-shipping-methods');
        return;
      }
    }

    // 3. Kliknutí na řádek dopravy (zaznamená ID dopravy i při kliku na label/tlačítko výdejního místa)
    var shippingRow = target.closest('#order-shipping-methods .radio-wrapper');
    if (shippingRow) {
      var sRadio = shippingRow.querySelector('input[type="radio"][name="shippingId"]');
      if (sRadio && isAvailable(sRadio)) {
        userShippingId = sRadio.value;
        // Ponecháme nativní průběh kliku pro Shoptet a widget GLS
      }
    }

    // 4. Kliknutí na řádek platby
    var billingRow = target.closest('#order-billing-methods .radio-wrapper');
    if (billingRow && userShippingId !== null) {
      var bRadio = billingRow.querySelector('input[type="radio"][name="billingId"]');
      if (bRadio && isAvailable(bRadio)) {
        userBillingId = bRadio.value;
      }
    }
  });

  // Blokování odeslání formuláře (např. Enterem v poli)
  document.addEventListener('submit', function (event) {
    var form = getForm();
    if (event.target === form) {
      handleFormSubmitAttempt(event);
    }
  });

  // Reakce na Shoptet AJAX překreslení košíku
  ['ShoptetShippingMethodUpdated', 'ShoptetBillingMethodUpdated', 'ShoptetDOMPageContentLoaded'].forEach(function (eventName) {
    document.addEventListener(eventName, function () {
      enforceManualChoice(false);
    });
  });

  // Návrat tlačítkem Zpět v prohlížeči (z historie / cache)
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      userShippingId = null;
      userBillingId = null;
    }
    enforceManualChoice(false);
  });

  // Inicializace po načtení dokumentu + pojistky proti zpožděnému předvýběru Shoptetem
  function init() {
    enforceManualChoice(false);
    setTimeout(function () { enforceManualChoice(false); }, 50);
    setTimeout(function () { enforceManualChoice(false); }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
