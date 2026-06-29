(function () {
  if (typeof window === 'undefined') return;
  const freeze = Object.freeze;
  const font = (value) => freeze(value);
  window.CK_WIDGET_TYPOGRAPHY_DATA = freeze({
    curatedFonts: freeze({
      Inter: font({ source: 'google', spec: 'Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900', familyClass: 'sans' }),
      Manrope: font({ source: 'google', spec: 'Manrope:wght@200..800', familyClass: 'sans' }),
      'Open Sans': font({ source: 'google', spec: 'Open+Sans:ital,wght@0,300..800;1,300..800', familyClass: 'sans' }),
      Lato: font({ source: 'google', spec: 'Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900', familyClass: 'sans' }),
      Roboto: font({ source: 'google', spec: 'Roboto:ital,wght@0,100..900;1,100..900', familyClass: 'sans' }),
      Montserrat: font({ source: 'google', spec: 'Montserrat:ital,wght@0,100..900;1,100..900', familyClass: 'sans' }),
      Raleway: font({ source: 'google', spec: 'Raleway:ital,wght@0,100..900;1,100..900', familyClass: 'sans' }),
      'Libre Baskerville': font({ source: 'google', spec: 'Libre+Baskerville:ital,wght@0,400..700;1,400..700', familyClass: 'serif' }),
      Lora: font({ source: 'google', spec: 'Lora:ital,wght@0,400..700;1,400..700', familyClass: 'serif' }),
      'Cormorant Garamond': font({ source: 'google', spec: 'Cormorant+Garamond:ital,wght@0,300..700;1,300..700', familyClass: 'serif' }),
      'Crimson Text': font({ source: 'google', spec: 'Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700', familyClass: 'serif' }),
      Gabriela: font({ source: 'google', spec: 'Gabriela', familyClass: 'serif' }),
      Michroma: font({ source: 'google', spec: 'Michroma', familyClass: 'sans' }),
      'Playfair Display': font({ source: 'google', spec: 'Playfair+Display:ital,wght@0,400..900;1,400..900', familyClass: 'serif' }),
      Cookie: font({ source: 'google', spec: 'Cookie', familyClass: 'sans' }),
      'Homemade Apple': font({ source: 'google', spec: 'Homemade+Apple', familyClass: 'sans' }),
      'Permanent Marker': font({ source: 'google', spec: 'Permanent+Marker', familyClass: 'sans' }),
      'Shadows Into Light': font({ source: 'google', spec: 'Shadows+Into+Light', familyClass: 'sans' }),
    }),
  });
})();
