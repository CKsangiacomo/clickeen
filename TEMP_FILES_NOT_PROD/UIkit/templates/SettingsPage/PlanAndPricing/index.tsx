import Button from "@/components/Button";
import Item from "../Item";

import { items } from "./items";

const PlanAndPricing = ({}) => {
    return (
        <Item
            title="Plan & Pricing"
            description="Manage your subscription plans. Choose a plan that best suits your needs, compare features, and adjust your subscription as needed."
        >
            <div className="flex flex-col gap-4">
                {items.map((item, index) => (
                    <div
                        className="border border-gray-100 rounded-2xl"
                        key={index}
                    >
                        <div className="flex justify-between items-center p-4">
                            <div className="text-body-lg font-semibold">
                                {item.title}
                            </div>
                            <Button
                                className={
                                    item.title === "Pro Plan"
                                        ? "!bg-gray-50 !text-gray-500 hover:!text-gray-900"
                                        : ""
                                }
                                isSecondary={item.title !== "Advanced Plan"}
                                isPrimary={item.title === "Advanced Plan"}
                                isSmall
                            >
                                {item.title === "Basic Plan"
                                    ? "Downgrade"
                                    : item.title === "Pro Plan"
                                    ? "Current Plan"
                                    : "Tree Trial - 30 Days"}
                            </Button>
                        </div>
                        <div className="p-4 pb-6 border-t border-gray-100">
                            <div className="font-medium text-gray-500">
                                <span className="text-h4 text-gray-900">
                                    ${item.price}
                                </span>{" "}
                                / month
                            </div>
                            <div className="mt-1 font-medium text-gray-500">
                                {item.description}
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="flex flex-wrap -mt-1 -mx-0.5">
                                    {item.features.map((feature, index) => (
                                        <div
                                            className="flex items-center gap-2 w-[calc(50%-0.5rem)] mt-1 mx-0.5 text-body-sm font-medium text-gray-900 max-md:w-[calc(100%-0.5rem)]"
                                            key={index}
                                        >
                                            <svg
                                                className="size-4 shrink-0 fill-primary-500"
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="16"
                                                height="16"
                                                viewBox="0 0 16 16"
                                            >
                                                <path d="M7.997.58a7.42 7.42 0 0 1 7.417 7.417 7.42 7.42 0 0 1-7.417 7.417A7.42 7.42 0 0 1 .58 7.997 7.42 7.42 0 0 1 7.997.58zm0 1.5A5.92 5.92 0 0 0 2.08 7.997a5.92 5.92 0 0 0 5.917 5.917 5.92 5.92 0 0 0 5.917-5.917A5.92 5.92 0 0 0 7.997 2.08zm2.47 3.72a.75.75 0 0 1 1.061 1.061l-4 4a.75.75 0 0 1-1.061 0l-2-2A.75.75 0 1 1 5.527 7.8l1.47 1.469L10.466 5.8z" />
                                            </svg>
                                            {feature}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Item>
    );
};

export default PlanAndPricing;
