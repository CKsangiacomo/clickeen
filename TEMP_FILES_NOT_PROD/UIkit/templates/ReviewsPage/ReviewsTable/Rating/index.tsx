type Props = {
    value: number;
};

const Rating = ({ value }: Props) => (
    <div className="flex">
        {Array.from({ length: 5 }).map((_, index) => (
            <svg
                className={`size-5 ${
                    index < value ? "fill-warning-100" : "fill-gray-100"
                }`}
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                key={index}
            >
                <path d="M10.86 3.078a.94.94 0 0 0-1.732 0L7.647 6.637a.94.94 0 0 1-.785.574l-3.505.305a.94.94 0 0 0-.566 1.612l2.662 2.54c.241.23.342.571.265.896l-.902 3.778a.94.94 0 0 0 1.401 1.018l3.287-2.007a.94.94 0 0 1 .978 0l3.287 2.007a.94.94 0 0 0 1.401-1.018l-.901-3.777c-.078-.325.024-.667.266-.897l2.671-2.538a.94.94 0 0 0-.565-1.614l-3.516-.305a.94.94 0 0 1-.785-.574L10.86 3.078z" />
            </svg>
        ))}
    </div>
);

export default Rating;
