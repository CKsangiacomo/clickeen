import Select from "@/components/Select";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import { SelectOption } from "@/types/select";

type Props = {
    className?: string;
    title: string;
    children: React.ReactNode;
    selectOptions?: SelectOption[];
    selectValue?: SelectOption;
    selectOnChange?: (value: SelectOption) => void;
    rightContent?: React.ReactNode;
};

const Widget = ({
    className,
    title,
    children,
    selectOptions,
    selectValue,
    selectOnChange,
    rightContent,
}: Props) => (
    <div className={`border border-gray-100 rounded-2xl ${className || ""}`}>
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-gray-100">
            <div className="mr-auto text-body-lg font-semibold">{title}</div>
            {rightContent ? (
                rightContent
            ) : (
                <div className="flex gap-2">
                    {selectOptions && selectValue && selectOnChange && (
                        <Select
                            className="min-w-20 max-md:hidden"
                            classButton="shadow-xs"
                            value={selectValue}
                            onChange={selectOnChange}
                            options={selectOptions}
                            isSmall
                        />
                    )}
                    <Button icon="refresh" isSecondary isSmall isSquare />
                </div>
            )}
        </div>
        <div className="">{children}</div>
    </div>
);

export default Widget;
