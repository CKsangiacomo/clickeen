import { useState } from "react";
import Field from "@/components/Field";
import Select from "@/components/Select";
import { SelectOption } from "@/types/select";
import Item from "../Item";

const industries = [
    { id: 0, name: "Music" },
    { id: 1, name: "Technology" },
    { id: 2, name: "Sports" },
];

const currencies = [
    { id: 0, name: "US Dollar" },
    { id: 1, name: "EUR Euro" },
    { id: 2, name: "GBP Pound Sterling" },
];

const countries = [
    { id: 0, name: "United States" },
    { id: 1, name: "Germany" },
    { id: 2, name: "United Kingdom" },
];

const General = ({}) => {
    const [companyName, setCompanyName] = useState("");
    const [industry, setIndustry] = useState<SelectOption>(industries[0]);
    const [currency, setCurrency] = useState<SelectOption>(currencies[0]);
    const [addressName, setAddressName] = useState("");
    const [country, setCountry] = useState<SelectOption>(countries[0]);
    const [city, setCity] = useState("");
    const [address, setAddress] = useState("");
    const [postalCode, setPostalCode] = useState("");

    return (
        <>
            <Item
                title="Account Details"
                description="Your users will use this information to contact you."
            >
                <div className="flex flex-col gap-4">
                    <Field
                        label="Company Name"
                        placeholder="Enter company name"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                    />
                    <Select
                        label="Payment Method"
                        value={industry}
                        onChange={setIndustry}
                        options={industries}
                        required
                    />
                    <Select
                        label="Currency"
                        value={currency}
                        onChange={setCurrency}
                        options={currencies}
                        required
                    />
                </div>
            </Item>
            <Item
                title="Address"
                description="This address will appear on your invoice."
            >
                <div className="flex flex-col gap-4">
                    <Field
                        label="Address Name"
                        placeholder="Enter address name"
                        type="text"
                        value={addressName}
                        onChange={(e) => setAddressName(e.target.value)}
                        required
                    />
                    <Select
                        label="Country or Region"
                        value={country}
                        onChange={setCountry}
                        options={countries}
                        required
                    />
                    <Field
                        label="City"
                        placeholder="Enter city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        required
                    />
                    <div className="flex gap-4 max-md:flex-col">
                        <Field
                            className="grow"
                            label="Address"
                            placeholder="Enter address"
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            required
                        />
                        <Field
                            className="shrink-0 w-36 max-md:w-full"
                            label="Postal Code"
                            placeholder="Enter code"
                            type="text"
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value)}
                            required
                        />
                    </div>
                </div>
            </Item>
        </>
    );
};

export default General;
