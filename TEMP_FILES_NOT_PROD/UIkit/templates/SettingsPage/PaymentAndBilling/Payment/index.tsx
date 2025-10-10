import { useState } from "react";
import Icon from "@/components/Icon";
import Image from "@/components/Image";
import Actions from "@/components/Actions";

import { cards } from "./cards";

const Payment = ({}) => {
    const [activeCard, setActiveCard] = useState(0);

    return (
        <div className="flex flex-col gap-4">
            {cards.map((card) => (
                <div
                    className="group flex items-center gap-4 p-4 border border-gray-100 rounded-xl cursor-pointer"
                    key={card.id}
                    onClick={() => setActiveCard(card.id)}
                >
                    <div
                        className={`relative flex justify-center items-center shrink-0 size-5 rounded-md border transition-colors group-hover:border-primary-500 ${
                            activeCard === card.id
                                ? "border-primary-500 bg-primary-500"
                                : "border-gray-100 bg-white"
                        }`}
                    >
                        <Icon
                            className={`!size-4 fill-white transition-opacity ${
                                activeCard === card.id
                                    ? "opacity-100"
                                    : "opacity-0"
                            }`}
                            name="check"
                        />
                    </div>
                    <div className="w-14 rounded-lg border border-gray-100 overflow-hidden">
                        <Image
                            className="w-full h-auto opacity-100"
                            src={card.logo}
                            width={56}
                            height={40}
                            alt=""
                        />
                    </div>
                    <div className="mr-auto">
                        <div className="flex items-center gap-2 mb-1">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div
                                    className="flex gap-1 [&>*]:size-1 [&>*]:rounded-full [&>*]:bg-gray-900"
                                    key={index}
                                >
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            ))}
                            <div className="font-semibold">
                                {card.number.slice(-4)}
                            </div>
                        </div>
                        <div className="font-medium text-gray-500">
                            Expiry {card.expiry}
                        </div>
                    </div>
                    <Actions />
                </div>
            ))}
        </div>
    );
};

export default Payment;
