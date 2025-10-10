type Props = {
    title: string;
    description: string;
    children: React.ReactNode;
};

const Item = ({ title, description, children }: Props) => (
    <div className="flex gap-6 p-6 not-last:border-b not-last:border-gray-100 max-2xl:gap-4 max-lg:block">
        <div className="shrink-0 w-92 max-4xl:w-75 max-2xl:w-60 max-lg:w-full max-lg:mb-6">
            <div className="text-h6">{title}</div>
            <div className="mt-1 text-gray-500 font-medium">{description}</div>
        </div>
        <div className="grow">{children}</div>
    </div>
);

export default Item;
