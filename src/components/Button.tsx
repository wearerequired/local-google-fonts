import classnames from 'classnames';

export default function Button( { children, ...props }: any ) {
	return (
		<button
			{...props}
			class={ classnames( "rounded-md border border-transparent bg-sky-700 py-2 px-4 text-sm font-medium text-white hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:text-slate-400 disabled:pointer-events-none drop-shadow-md", props.class ) }
		>
			{children}
		</button>
	);
};
