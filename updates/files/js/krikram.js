/* ============ Varshik Krikram — annual events of Satlok (source: official site) ============ */
(function (g) {
  var EV = [
    { chip: ["JAN", "FEB"], win: [0, 1],
      nm: { hi: "कबीर साहेब सतलोक प्रस्थान दिवस", en: "Satlok Prasthan Divas of God Kabir", pa: "ਕਬੀਰ ਸਾਹਿਬ ਸਤਲੋਕ ਪ੍ਰਸਥਾਨ ਦਿਵਸ" },
      ti: { hi: "माघ शुक्ल एकादशी", en: "Magh Shukla Ekadashi", pa: "ਮਾਘ ਸ਼ੁਕਲ ਏਕਾਦਸ਼ੀ" } },
    { chip: ["17", "FEB"], fx: [1, 17],
      nm: { hi: "संत रामपाल जी महाराज बोध दिवस", en: "Bodh Divas of Sant Rampal Ji Maharaj", pa: "ਸੰਤ ਰਾਮਪਾਲ ਜੀ ਮਹਾਰਾਜ ਬੋਧ ਦਿਵਸ" },
      ti: { hi: "15–17 फरवरी", en: "15–17 Feb", pa: "15–17 ਫਰਵਰੀ" } },
    { chip: ["FEB", "MAR"], win: [1, 2],
      nm: { hi: "संत गरीबदास जी महाराज बोध दिवस", en: "Bodh Divas of Sant Garib Das Ji Maharaj", pa: "ਸੰਤ ਗਰੀਬਦਾਸ ਜੀ ਮਹਾਰਾਜ ਬੋਧ ਦਿਵਸ" },
      ti: { hi: "फाल्गुन शुक्ल द्वादशी", en: "Phalguna Shukla Dwadashi", pa: "ਫੱਗੁਨ ਸ਼ੁਕਲ ਦ੍ਵਾਦਸ਼ੀ" } },
    { chip: ["MAY", "JUN"], win: [4, 5],
      nm: { hi: "कबीर साहेब प्रकट दिवस", en: "God Kabir Manifestation Day", pa: "ਕਬੀਰ ਸਾਹਿਬ ਪ੍ਰਗਟ ਦਿਵਸ" },
      ti: { hi: "ज्येष्ठ शुक्ल पूर्णिमा", en: "Jyeshtha Shukla Purnima", pa: "ਜੇਠ ਸ਼ੁਕਲ ਪੂਰਨਿਮਾ" } },
    { chip: ["8", "SEP"], fx: [8, 8],
      nm: { hi: "संत रामपाल जी महाराज अवतरण दिवस", en: "Sant Rampal Ji Appearance Day", pa: "ਸੰਤ ਰਾਮਪਾਲ ਜੀ ਮਹਾਰਾਜ ਅਵਤਰਨ ਦਿਵਸ" },
      ti: { hi: "6–8 सितंबर", en: "6–8 Sep", pa: "6–8 ਸਤੰਬਰ" } },
    { chip: ["OCT", "NOV"], win: [9, 10],
      nm: { hi: "दिव्य धर्म यज्ञ दिवस", en: "Divine Dharm Yagya Divas", pa: "ਦਿੱਵ ਧਰਮ ਯੱਗ ਦਿਵਸ" },
      ti: { hi: "कार्तिक कृष्ण प्रतिपदा", en: "Kartik Krishna Pratipada", pa: "ਕੱਤਕ ਕ੍ਰਿਸ਼ਨ ਪ੍ਰਤਿਪਦਾ" } }
  ];

  function daysTo(m, d) {
    var n = new Date(); var today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    var t = new Date(n.getFullYear(), m, d);
    if (t < today) t = new Date(n.getFullYear() + 1, m, d);
    return Math.round((t - today) / 864e5);
  }

  function render(page) {
    var lang = g.I18N ? I18N.getLang() : "hi";
    var card = UI.el("div", { class: "card" });
    card.appendChild(UI.el("h", { class: "big", style: "display:block;margin-bottom:4px", text: UI.t("krikram") }));
    card.appendChild(UI.el("div", { class: "tiny", style: "margin-bottom:8px", text: UI.t("krikram_sub") }));
    EV.forEach(function (e) {
      var row = UI.el("div", { class: "kr-item" });
      row.appendChild(UI.el("div", { class: "kr-date" }, [
        UI.el("b", { text: e.chip[0] }), UI.el("span", { text: e.chip[1] })
      ]));
      row.appendChild(UI.el("div", { class: "kr-tx" }, [
        UI.el("b", { text: e.nm[lang] || e.nm.hi }),
        UI.el("span", { text: e.ti[lang] || e.ti.hi })
      ]));
      if (e.fx) {
        var d = daysTo(e.fx[0], e.fx[1]);
        row.appendChild(UI.el("span", { class: "kr-soon", text: d === 0 ? UI.t("kr_today") : d + " " + UI.t("d_left") }));
      } else {
        var m = new Date().getMonth();
        if (m >= e.win[0] && m <= e.win[1]) row.appendChild(UI.el("span", { class: "kr-soon", text: UI.t("kr_now") }));
      }
      card.appendChild(row);
    });
    page.appendChild(card);
  }

  g.Krikram = { render: render };
})(window);
