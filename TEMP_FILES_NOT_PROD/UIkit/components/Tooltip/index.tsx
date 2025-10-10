import { useId } from "react";
import { Tooltip as ReactTooltip, PlacesType } from "react-tooltip";
import Icon from "@/components/Icon";

interface TooltipProps {
    className?: string;
    content: string;
    place?: PlacesType;
    children?: React.ReactNode;
}

const Tooltip = ({
    className,
    content,
    place = "right",
    children,
}: TooltipProps) => {
    const idTooltip = useId();

    return (
        <>
            <div
                className={`flex fill-gray-300 transition-color cursor-pointer hover:fill-gray-900 ${
                    className || ""
                }`}
                data-tooltip-id={idTooltip}
                data-tooltip-content={content}
                data-tooltip-place={place}
            >
                {children || (
                    <Icon
                        className="fill-inherit transition-colors"
                        name="info"
                    />
                )}
            </div>
            <ReactTooltip id={idTooltip} />
        </>
    );
};

export default Tooltip;
