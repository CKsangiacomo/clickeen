import Widget from "@/components/Widget";

import { calendar, events } from "./content";

const DeadlineAndCalendar = ({}) => {
    return (
        <Widget
            className="shrink-0 w-108 max-4xl:w-88 max-2xl:w-78 max-lg:w-full max-lg:mt-6"
            title="Deadline & Calendar"
        >
            <div className="p-5">
                <div className="flex justify-between mb-4">
                    {calendar.map((item, index) => (
                        <div className="flex flex-col items-center" key={index}>
                            <div className="mb-1 text-body-sm text-gray-500">
                                {item.title}
                            </div>
                            <div
                                className={`flex justify-center items-center size-8 rounded-full font-medium ${
                                    index === 3
                                        ? "bg-primary-50 font-semibold text-primary-500"
                                        : ""
                                }`}
                            >
                                {item.number}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex flex-col gap-4">
                    {events.map((item, index) => (
                        <div
                            className="relative px-4 py-3.5 rounded-xl border border-gray-100 before:absolute before:top-1/2 before:left-0 before:-translate-y-1/2 before:w-1 before:h-8 before:bg-primary-500 before:rounded-r"
                            key={index}
                        >
                            <div className="mb-1 font-medium">{item.title}</div>
                            <div className="flex items-center text-gray-500">
                                <div className="">{item.status}</div>
                                <div className="size-1 mx-2 rounded-full bg-gray-500"></div>
                                <div className="">{item.date}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Widget>
    );
};

export default DeadlineAndCalendar;
