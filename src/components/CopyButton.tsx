
import { useRef, useEffect } from 'preact/hooks';
import classnames from 'classnames';
import Clipboard from 'clipboard';

export default function CopyButton( { text, ...props }: any ) {
	const ref = useRef( null );

	useEffect( () => {
		if ( ! ref.current ) {
			return;
		}

		const clipboard = new Clipboard( ref.current, {
			text: () => text,
		} );

		clipboard.on( 'success', ( { clearSelection } ) => {
			clearSelection();
			if ( ref.current ) {
				(ref.current as HTMLButtonElement).focus();
			}
		} );

		return () => {
			clipboard.destroy();
		};
	}, [ text ] );

	return (
		<button
			{...props}
			type="button"
			class={ classnames( "rounded-md border border-transparent bg-slate-500 py-1 px-4 font-medium text-white text-sm uppercase hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:text-slate-400 disabled:pointer-events-none drop-shadow-md", props.class ) }
			ref={ ref }
		>
			Copy
		</button>
	);
};
