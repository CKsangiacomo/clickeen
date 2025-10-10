import { useState } from "react";
import Select from "@/components/Select";
import { SelectOption } from "@/types/select";
import Item from "../Item";

const timeZones = [
    { id: 0, name: "Pacific Standard Time (PST)" },
    { id: 1, name: "Eastern Standard Time (EST)" },
    { id: 2, name: "Central Standard Time (CST)" },
];

const languages = [
    { id: 0, name: "English (United States)" },
    { id: 1, name: "Spanish (Mexico)" },
    { id: 2, name: "French (Canada)" },
];

const TimeAndLanguage = ({}) => {
    const [timeZone, setTimeZone] = useState<SelectOption>(timeZones[0]);
    const [language, setLanguage] = useState<SelectOption>(languages[0]);

    return (
        <>
            <Item
                title="Time"
                description="Set your preferred time zone to ensure that all activities align with your local time."
            >
                <Select
                    label="Time Zone"
                    note="The current time is 3:45 PM."
                    value={timeZone}
                    onChange={setTimeZone}
                    options={timeZones}
                />
            </Item>
            <Item
                title="Set you language"
                description="Choose the language. All text and communication will be displayed in the language you select."
            >
                <Select
                    label="Language"
                    value={language}
                    onChange={setLanguage}
                    options={languages}
                />
            </Item>
        </>
    );
};

export default TimeAndLanguage;
