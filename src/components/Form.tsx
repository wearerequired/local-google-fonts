import { useState, useRef, useEffect } from 'preact/hooks';
import { parse, Root, AtRule, Comment, Declaration } from 'postcss';
import valueParser from 'postcss-value-parser'
import JSZip from 'jszip'

import Button from './Button';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36';

const parseFontFacesFromCss = (css: string): Map<string, any> => {
	const root = parse( css );

	const fontFaces = new Map<string, any>;

	// Find all @font-face
	root.walkAtRules( 'font-face', atRule => {
		// Get charset
		const annotation = atRule.prev()
		let charset = 'latin';
		if (annotation?.type === 'comment') {
			charset = annotation.text;
		}

		const fontData: { [key: string]: any } = {
			charset,
			'font-family': '',
			'font-style': '',
			'font-weight': '',
			src: {
				url: '',
				format: '',
			},
			'unicode-range': '',
		}

		atRule.walkDecls( (decl) => {
			if ( decl.prop === 'src' ) {
				const parsed = valueParser(decl.value);
				parsed.walk( ( node ) => {
					if ( node.type === 'function' && node.value === 'url' ) {
						fontData.src.url = node.nodes[0].value;
					} else if ( node.type === 'function' && node.value === 'format' ) {
						fontData.src.format = node.nodes[0].value;
					}
				});
			} else {
				fontData[ decl.prop ] = decl.value;
			}
		});

		let key = `${fontData['font-family']}-${fontData.charset}-${fontData['font-style']}-${fontData['font-weight']}`;
		key = key.replace(/['\[\]]/g, '');
		key = key.replace(/ /g, '-');
		key = key.toLocaleLowerCase();

		fontFaces.set( key, fontData );
	});

	return fontFaces;
}

const loadAndCreateFontsZip = async ( fonts: Map<string, any> ) => {
	const zip = new JSZip();

	const remoteFiles = Array.from( fonts ).map( async ( [filename, { src }] ) => {
		const response = await fetch( src.url, {
			headers: {
				'User-Agent': USER_AGENT,
			},
		});
		const data = await response.arrayBuffer();

		zip.file(`${filename}.${src.format}`, data);

		return data;
	});

	return await Promise.all(remoteFiles).then( async () => {
		return zip.generateAsync({type:"base64"});
	});
}

const createFontsCss = ( fonts: Map<string, any> ): string => {
	const root = new Root();

	fonts.forEach( ( font, key ) => {
		const rule = new AtRule({ name: 'font-face' });
		rule.append( new Declaration({ prop: 'font-family', value: font['font-family'] } ) );
		rule.append( new Declaration({ prop: 'font-style', value: font['font-style'] } ) );
		rule.append( new Declaration({ prop: 'font-weight', value: font['font-weight'] } ) );
		rule.append( new Declaration({ prop: 'font-display', value: 'swap' } ) );
		rule.append( new Declaration({ prop: 'src', value: `url(../fonts/${key}.woff2) format('woff2')` } ) );
		rule.append( new Declaration({ prop: 'unicode-range', value: font['unicode-range']} ) );

		root.append( rule );

		const comment = new Comment({ text: font.charset });
		rule.before( comment );

	} );

	return root.toString();
}

export default function Form() {
	const [url, setUrl] = useState('');
	const [isLoading, setIsLoading ] = useState( false );
	const [zip, setZip ] = useState( '' );
	const [fontsCss, setFontsCss ] = useState( '' );
	const [availableFonts, setAvailableFonts ] = useState( new Map<string, any>() );
	const [selectedFonts, setSelectedFonts ] = useState( new Map<string, any>() );
	const cssTextareaRef = useRef( null );

	useEffect( () => {
		if ( fontsCss && cssTextareaRef.current ) {
			(cssTextareaRef.current as HTMLTextAreaElement).select();
		}
	}, [fontsCss] );

	const loadCSS = async ( event: Event ) => {
		event.preventDefault();

		setIsLoading( true );

		const response = await fetch(url, {
			headers: {
				'Accept': 'text/css',
				'User-Agent': USER_AGENT,
			},
		});

		if ( response.status !== 200 ) {
			console.error( response.statusText );
			return;
		}

		const css = await response.text();
		const fontFaces = parseFontFacesFromCss( css );

		setAvailableFonts( fontFaces );
		setIsLoading( false );
	}

	const onUrlChange = ( event: Event ) => {
		if (event.target instanceof HTMLInputElement) {
			setUrl( event.target.value )
		}
	}

	const onFontChange = ( event: Event ) => {
		if (event.target instanceof HTMLInputElement) {
			const { value, checked } = event.target;

			const newSelectedFont =  new Map( [ ...selectedFonts ] );
			if ( checked ) {
				newSelectedFont.set( value, availableFonts.get( value ) );
			} else {
				newSelectedFont.delete( value );
			}

			setSelectedFonts( newSelectedFont );
		}
	}

	const createZip = async ( event: Event ) => {
		event.preventDefault();

		setIsLoading( true );

		const zip = await loadAndCreateFontsZip( selectedFonts );
		setZip( zip );

		const css = createFontsCss( selectedFonts );
		setFontsCss( css );

		setIsLoading( false );
	}

	const reset = () => {
		setUrl( '' );
		setAvailableFonts( new Map() );
		setSelectedFonts( new Map() );
		setZip( '' );
		setFontsCss( '' );
	}

	return (
		<>
			{ ! isLoading && ! availableFonts.size && (
				<form class="space-y-6" onSubmit={ loadCSS }>
					<p>Go to <a class="text-sky-600 hover:text-sky-800 underline" href="https://fonts.google.com/">Google Fonts</a> and select your font families. Copy the CSS URL and paste it into the URL field below.</p>
					<div>
						<label class="block">
							<span class="after:content-['*'] after:ml-0.5 after:text-red-500 block text-sm font-medium text-slate-700">
								URL
							</span>
							<input type="url" class="mt-1 px-3 py-2 bg-sky-50 border shadow-sm border-slate-300 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-sky-500 block w-full rounded-md sm:text-sm focus:ring-1 drop-shadow-sm" placeholder="https://fonts.googleapis.com/css2?family=…" value={ url } onInput={ onUrlChange } />
						</label>
					</div>
					<div>
						<Button type="submit" disabled={ ! url }>Load CSS</Button>
					</div>
				</form>
			) }
			{ isLoading && (
				<p>Loading...</p>
			) }
			{ ! isLoading && !! availableFonts.size && ! zip && (
				<form class="space-y-6" onSubmit={ createZip }>
					<p>Select the fonts and charsets you want to download.</p>
					<fieldset class="space-y-2">
						{
							Array.from( availableFonts ).map( ( [key, font] ) => {
								return (
									<div key={ key }>
										<label class="flex items-center">
											<input type="checkbox" class="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded" value={ key } checked={ selectedFonts.has( key ) } onChange={ onFontChange }/>
											<span class="ml-2">
												<strong>{ font['font-family'].replace(/'/g, '') }</strong> { font['charset'] } { font['font-style'] } { font['font-weight'] }
											</span>
										</label>
									</div>
								);
							})
						}
					</fieldset>
					<div>
						<Button type="submit" disabled={ selectedFonts.size === 0 }>Create ZIP and CSS</Button>
					</div>
				</form>
			) }
			{ ! isLoading && zip && (
				<div class="space-y-6">
					<p>Copy the CSS and download the ZIP file with the font files.</p>
					<div>
						<textarea ref={ cssTextareaRef } class="px-3 py-2 bg-sky-50 border border-slate-300 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-sky-500 block w-full rounded-md focus:ring-1 font-mono text-xs drop-shadow-md resize-none" readonly rows={ fontsCss.split('\n').length + 2 }>{ fontsCss }</textarea>
					</div>
					<div class="flex align-center">
						<div>
							<a class="block rounded-md border border-transparent bg-sky-700 py-4 px-6 text-m font-medium text-white hover:bg-sky-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2" href={ `data:application/zip;base64,${zip}` } download="fonts.zip">Download fonts.zip</a>
						</div>
						<button class="ml-10 font-medium text-red-500" type="button" onClick={ reset }>Reset</button>
					</div>
				</div>
			) }
		</>
	);
}
