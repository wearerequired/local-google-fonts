export default function Button( { children, ...props }: any ) {
	return (
		<button
			{...props}
			class="rounded-md border border-transparent bg-sky-700 py-2 px-4 text-sm font-medium text-white hover:bg-sky-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-75 disabled:pointer-events-none"
		>
			{children}
		</button>
	);
};
