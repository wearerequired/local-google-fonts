export default function Link( { children, ...props }: any ) {
	return (
		<a
			{...props}
			class="text-sky-600 hover:text-sky-800 underline"
		>
			{children}
		</a>
	);
};
