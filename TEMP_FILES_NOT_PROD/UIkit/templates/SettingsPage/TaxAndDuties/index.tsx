import { useState } from "react";
import Field from "@/components/Field";
import Select from "@/components/Select";
import { SelectOption } from "@/types/select";
import Item from "../Item";
import Table from "./Table";

const countries = [
    { id: 0, name: "United States" },
    { id: 1, name: "Germany" },
    { id: 2, name: "United Kingdom" },
];

const TaxAndDuties = ({}) => {
    const [fullName, setFullName] = useState("");
    const [country, setCountry] = useState<SelectOption>(countries[0]);
    const [permanentResidence, setPermanentResidence] = useState("");
    const [mailingAddress, setMailingAddress] = useState("");

    return (
        <>
            <Item
                title="Tax & duties"
                description="Review the taxes and duties associated with your purchases and subscriptions."
            >
                <Table />
            </Item>
            <Item
                title="Tax from review"
                description="Manage where you collect taxes and duties. Check with a tax expert if you're unsure where you have a tax obligation."
            >
                <div className="flex flex-col gap-4">
                    <Field
                        label="Full Name"
                        placeholder="Enter full name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                    />
                    <Select
                        label="Treaty Country"
                        value={country}
                        onChange={setCountry}
                        options={countries}
                        required
                    />
                    <Field
                        label="Permanent Residence"
                        placeholder="Enter residence"
                        type="text"
                        value={permanentResidence}
                        onChange={(e) => setPermanentResidence(e.target.value)}
                        required
                    />
                    <Field
                        label="Mailing Address"
                        placeholder="Enter address"
                        type="email"
                        value={mailingAddress}
                        onChange={(e) => setMailingAddress(e.target.value)}
                        required
                    />
                </div>
            </Item>
        </>
    );
};

export default TaxAndDuties;
