import { Switch as HeadlessSwitch } from "@headlessui/react";

type SwitchProps = {
    className?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
};

const Switch = ({ className, checked, onChange }: SwitchProps) => (
    <HeadlessSwitch
        className={`group inline-flex shrink-0 w-11 h-6 items-center rounded-full bg-gray-50 transition-colors data-[checked]:bg-primary-500 ${
            className || ""
        }`}
        checked={checked}
        onChange={onChange}
    >
        <span className="size-5 translate-x-0.5 rounded-full bg-white shadow-sm transition group-data-[checked]:translate-x-5.5" />
    </HeadlessSwitch>
);

export default Switch;
