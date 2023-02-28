import { useState, useRef, useEffect } from 'preact/hooks';
import { parse, Root, AtRule, Comment, Declaration } from 'postcss';
import valueParser from 'postcss-value-parser'
import JSZip from 'jszip'
import classnames from 'classnames';

import Button from './Button';
import Link from './Link';
import CopyButton from './CopyButton';
import CodeTextarea from './CodeTextarea';

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
		const response = await fetch( src.url);
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
		rule.append( new Declaration({ prop: 'src', value: `url(../fonts/${key}.${font.src.format}) format('${font.src.format}')` } ) );
		rule.append( new Declaration({ prop: 'unicode-range', value: font['unicode-range']} ) );

		root.append( rule );

		const comment = new Comment({ text: font.charset });
		rule.before( comment );
	} );

	return root.toString();
}

interface WpThemeJsonSettingsTypographyFontFamily {
	name: string;
	slug: string;
	fontFamily: string;
	fontFace: any[];
}

interface WpThemeJsonSettingsTypography {
	fontFamilies: WpThemeJsonSettingsTypographyFontFamily[];
}

interface WpThemeJsonSettings {
	typography: WpThemeJsonSettingsTypography;
}

interface WpThemeJson {
	version: number;
	settings: WpThemeJsonSettings;
}

const createThemeJson = ( fonts: Map<string, any> ): string => {
	const themeJson : WpThemeJson = {
		version: 2,
		settings: {
			typography: {
				fontFamilies: [],
			}
		}
	};

	fonts.forEach( ( font, key ) => {
		let entry = themeJson.settings.typography.fontFamilies.find( ( fontFamily ) => fontFamily.fontFamily === font['font-family'] );
		if ( ! entry ) {
			entry = {
				name: font['font-family'].replace( /'/g, '' ),
				slug: font['font-family'].toLocaleLowerCase().replace( / /g, '-' ),
				fontFamily: font['font-family'],
				fontFace: [],
			};

			themeJson.settings.typography.fontFamilies.push( entry );
		}

		entry.fontFace.push( {
			fontFamily: font['font-family'],
			fontWeight: font['font-weight'],
			fontStyle: font['font-style'],
			fontDisplay: 'swap',
			src: [
				`file:./assets/fonts/${key}.${font.src.format}`,
			],
			unicodeRange: font['unicode-range'],
		} );
	} );

	return JSON.stringify( themeJson, null, 2 );
}

export default function Form() {
	const [url, setUrl] = useState('https://fonts.googleapis.com/css2?family=Roboto:wght@100&display=swap');
	const [error, setError] = useState('');
	const [isLoading, setIsLoading ] = useState( false );
	const [zip, setZip ] = useState( '' );
	const [fontsCss, setFontsCss ] = useState( '' );
	const [themeJson, setThemeJson ] = useState( '' );
	const [availableFonts, setAvailableFonts ] = useState( new Map<string, any>() );
	const [selectedFonts, setSelectedFonts ] = useState( new Map<string, any>() );
	const [activeTab, setActiveTab] = useState( 'css' );

	const loadCSS = async ( event: Event ) => {
		event.preventDefault();

		setIsLoading( true );

		let response;
		try {
			response = await fetch(url, {
				headers: {
					'Accept': 'text/css',
				},
			});
		} catch ( e ) {
			console.error( e );
		}

		if ( ! response ) {
			setError( 'Error loading CSS' );
			setIsLoading( false );
			return;
		}

		if ( response.status !== 200 ) {
			console.error( response );
			setError( 'Error loading CSS' );
			setIsLoading( false );
			return;
		}

		const css = await response.text();

		let fontFaces;
		try {
			fontFaces = parseFontFacesFromCss( css );
		} catch ( e ) {
			console.error( e );
		}

		if ( ! fontFaces ) {
			setError( 'Error parsing CSS' );
			setIsLoading( false );
			return;
		}

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

			const newSelectedFonts =  new Map( [ ...selectedFonts ] );
			if ( checked ) {
				newSelectedFonts.set( value, availableFonts.get( value ) );
			} else {
				newSelectedFonts.delete( value );
			}

			setSelectedFonts( newSelectedFonts );
		}
	}

	const createZip = async ( event: Event ) => {
		event.preventDefault();

		setIsLoading( true );

		const zip = await loadAndCreateFontsZip( selectedFonts );
		setZip( zip );

		const css = createFontsCss( selectedFonts );
		setFontsCss( css );

		const themeJson = createThemeJson( selectedFonts );
		setThemeJson( themeJson );

		setIsLoading( false );
	}

	const reset = () => {
		setError( '' );
		setUrl( '' );
		setAvailableFonts( new Map() );
		setSelectedFonts( new Map() );
		setZip( '' );
		setFontsCss( '' );
		setThemeJson( '' );
		setActiveTab( 'css' );
	}

	const selectAllFonts = () => {
		if ( selectedFonts.size > 0 ) {
			setSelectedFonts( new Map() );
		} else {
			setSelectedFonts( new Map( [ ...availableFonts ] ) );
		}
	}

	const selectAllLatinFonts = () => {
		const newSelectedFonts =  new Map( [ ...selectedFonts ] );

		availableFonts.forEach( ( font, key ) => {
			if ( font.charset === 'latin' ) {
				newSelectedFonts.set( key, font );
			}
		} );

		setSelectedFonts( newSelectedFonts );
	}
	const selectAllLatinExtFonts = () => {
		const newSelectedFonts =  new Map( [ ...selectedFonts ] );

		availableFonts.forEach( ( font, key ) => {
			if ( font.charset === 'latin-ext' ) {
				newSelectedFonts.set( key, font );
			}
		} );

		setSelectedFonts( newSelectedFonts );
	}

	return (
		<>
			{ !! error && <div class="text-red-500">💥 { error } <button class="ml-1 text-black font-medium" type="button" onClick={ reset }>Try again</button></div> }
			{ ! error && ! isLoading && ! availableFonts.size && (
				<form class="space-y-6" onSubmit={ loadCSS }>
					<p class="max-w-prose">Here you can download the web fonts and create the necessary CSS or WordPress' theme.json for hosting Google Fonts locally.</p>
					<p class="max-w-prose">How? Go to <Link href="https://fonts.google.com/" target="_blank">Google Fonts</Link> and select your font families. Copy the CSS URL from the "Use&nbsp;on&nbsp;the&nbsp;web" section and paste it into the URL field below.</p>
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
					<p>Select the fonts and subsets you want to download.</p>
					<fieldset class="space-y-2 max-h-96 overflow-y-auto">
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
					<div class="flex flex-row gap-4">
						<button type="button" onClick={ selectAllFonts } class="text-sky-600 hover:text-sky-800">(De)select all</button>
						<button type="button" onClick={ selectAllLatinFonts } class="text-sky-600 hover:text-sky-800">Select latin</button>
						<button type="button" onClick={ selectAllLatinExtFonts } class="text-sky-600 hover:text-sky-800">Select latin-ext</button>
					</div>
					<div>
						<Button type="submit" disabled={ selectedFonts.size === 0 }>Create ZIP and CSS</Button>
					</div>
				</form>
			) }
			{ ! isLoading && zip && (
				<div class="space-y-6">
					<p>Copy the CSS or theme.json and download the ZIP file with the font files.</p>
					<div>
						<div class="flex rounded-md bg-slate-100 p-0.5 w-fit mb-2" role="tablist" aria-orientation="horizontal">
							<button class={ classnames( 'rounded-md py-2 px-4 text-sm font-medium', { 'bg-white': 'css' === activeTab } ) } id="zip-tab-css" role="tab" type="button" aria-selected={ 'css' === activeTab ? 'true' : 'false' } aria-controls="zip-tab-panel-css" onClick={ () => setActiveTab('css') }>
								<span class={ classnames( { 'text-slate-900': 'css' === activeTab, 'text-slate-600': 'css' !== activeTab } ) }>CSS</span>
							</button>
							<button class={ classnames( 'rounded-md py-2 px-4 text-sm font-medium', { 'bg-white': 'theme-json' === activeTab } ) } id="zip-tab-theme-json" role="tab" type="button" aria-selected={ 'theme-json' === activeTab ? 'true' : 'false' } aria-controls="zip-tab-panel-theme-json" onClick={ () => setActiveTab('theme-json') }>
								<span class={ classnames( { 'text-slate-900': 'theme-json' === activeTab, 'text-slate-600': 'theme-json' !== activeTab } ) }>theme.json</span>
							</button>
						</div>
						<div id="zip-tab-panel-css" hidden={ 'css' === activeTab ? undefined : true } class="relative">
							<CodeTextarea>{ fontsCss }</CodeTextarea>
							<CopyButton class="absolute bottom-1 right-1 py-1 px-2 text-sm uppercase" text={ fontsCss } />
						</div>
						<div id="zip-tab-panel-theme-json" hidden={ 'theme-json' === activeTab ? undefined : true } class="relative">
							<CodeTextarea>{ themeJson }</CodeTextarea>
							<CopyButton class="absolute bottom-1 right-1 py-1 px-2 text-sm uppercase" text={ themeJson }/>
						</div>
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
