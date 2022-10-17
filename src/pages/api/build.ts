import { parse } from 'postcss';
import valueParser from 'postcss-value-parser'
import JSZip from 'jszip'

import type { APIRoute } from 'astro';

export const post: APIRoute = async ({ request }) => {
	if (request.headers.get("Content-Type") === "application/json") {
	const body = await request.json();
	const url = body.url;

	const response = await fetch(url, {
		headers: {
			'Accept': 'text/css',
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36',
		},
	});

	if ( response.status !== 200 ) {
		return new Response(null, { status: 500 });
	}

	const css = await response.text();

	// Parse CSS into AST.
	const root = parse(css);

	const zip = new JSZip();

	const fontFiles: any[] = [];

	// Find all @font-face
	root.walkAtRules( 'font-face', atRule => {
		// Get font
		const annotation = atRule.prev()
		let charset = 'latin';
		if (annotation?.type === 'comment') {
			charset = annotation.text;
		}

		atRule.walkDecls( (decl) => {
			if ( decl.prop === 'src' ) {
				const parsed = valueParser(decl.value);
				parsed.walk( ( node ) => {
					if ( node.type === 'function' && node.value === 'url' ) {
						const url =  node.nodes[0].value;

						fontFiles.push( { url, charset } );
					}
				})
			}
			console.log( decl.prop, decl.value );
		});
	});

	const remoteFiles = fontFiles.map( async ( { url, charset } ) => {
		const response = await fetch(url);
		const data = await response.arrayBuffer();

		zip.file(`${charset}.woff2`, data);

		return data;
	});

	const userzip = await Promise.all(remoteFiles).then( async () => {
		return zip.generateAsync({type:"base64"});
	});

	// https://stackoverflow.com/questions/70801493/zip-files-folders-zips-from-remote-urls-with-jszip

	return new Response(JSON.stringify({
		message: "Your url was: " + url,
		css: css,
		userzip: userzip,
	  }), {
		status: 200
	  })
	}
	return new Response(null, { status: 400 });
  }
