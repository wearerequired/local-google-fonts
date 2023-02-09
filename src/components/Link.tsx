import classnames from 'classnames';

export default function Link( { children, ...props }: any ) {
	return (
		<a
			{...props}
			class={ classnames( "text-sky-600 hover:text-sky-800 underline", props.class ) }
		>
			{children}
		</a>
	);
};
