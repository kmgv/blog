// Reveal.js plugin: inlines external SVG files referenced via
// <div data-svg-embed="path/to/file.svg"></div>
//
// Fragments (and any other DOM-dependent behavior) only work on elements
// that are actually part of the page. An <img src="file.svg"> keeps the
// SVG opaque, so this fetches the file's markup and splices it into the
// slide in its place, letting `class="fragment"` inside the SVG work like
// any other fragment while the file itself stays separate on disk.
window.RevealSvgEmbed = {
	id: 'svg-embed',
	init: function (reveal) {
		var placeholders = Array.prototype.slice.call(
			document.querySelectorAll('[data-svg-embed]')
		);

		// Reveal sizes `.r-stretch` elements by setting an explicit
		// style.width/style.height that fills all remaining space on the
		// slide, then centers the slide by measuring its scrollHeight. A
		// CSS transform would only shrink the SVG visually - the layout box
		// (and therefore scrollHeight) stays at the full stretched size, so
		// the heading ends up pinned near the top instead of sitting above
		// the now-smaller SVG. Instead we let reveal compute the full-size
		// box as usual, then shrink that box for real (real width/height)
		// and re-run reveal's own centering formula for the slide.
		function applyShrink() {
			var svgs = document.querySelectorAll(
				'.reveal .slides section.present > svg[data-svg-shrink]'
			);

			Array.prototype.forEach.call(svgs, function (svg) {
				var factor = parseFloat(svg.getAttribute('data-svg-shrink'));
				var width = parseFloat(svg.style.width);
				var height = parseFloat(svg.style.height);
				if (!factor || !width || !height) return;

				svg.style.width = width * factor + 'px';
				svg.style.height = height * factor + 'px';

				var section = svg.parentElement;
				if (section) {
					var configHeight = reveal.getConfig().height;
					section.style.top =
						Math.max((configHeight - section.scrollHeight) / 2, 0) + 'px';
				}
			});
		}

		reveal.on('ready', applyShrink);
		reveal.on('slidechanged', applyShrink);

		return Promise.all(
			placeholders.map(function (placeholder) {
				var src = placeholder.getAttribute('data-svg-embed');
				var shrink = placeholder.getAttribute('data-svg-shrink');

				return fetch(src)
					.then(function (response) {
						return response.text();
					})
					.then(function (svgMarkup) {
						var wrapper = document.createElement('div');
						wrapper.innerHTML = svgMarkup;

						var svg = wrapper.querySelector('svg');
						if (!svg) return;

						placeholder.classList.forEach(function (cls) {
							svg.classList.add(cls);
						});
						if (!svg.classList.contains('r-stretch')) {
							svg.classList.add('r-stretch');
						}

						if (shrink) {
							svg.setAttribute('data-svg-shrink', shrink);
						}

						placeholder.replaceWith(svg);
					});
			})
		);
	},
};
