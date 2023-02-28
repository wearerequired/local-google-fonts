import classnames from 'classnames';

export default function CodeTextarea( { children, ...props }: any ) {
	return (
		<textarea class={ classnames( "px-3 py-2 bg-sky-50 border border-slate-300 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-sky-500 block w-full rounded-md focus:ring-1 font-mono text-xs drop-shadow-md resize-none max-h-96", props.class ) } readonly rows={ children.split('\n').length + 2 }>{ children }</textarea>
	);
};
