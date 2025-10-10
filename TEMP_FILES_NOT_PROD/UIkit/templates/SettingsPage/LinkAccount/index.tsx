import { useState } from "react";
import Field from "@/components/Field";
import Item from "../Item";

const LinkAccount = ({}) => {
    const [linkInstagram, setLinkInstagram] = useState("");
    const [linkFacebook, setLinkFacebook] = useState("");
    const [linkTwitter, setLinkTwitter] = useState("");
    const [linkYouTube, setLinkYouTube] = useState("");

    return (
        <Item
            title="Link Account"
            description="Your customers will use this information to contact you."
        >
            <div className="flex flex-col gap-4">
                <Field
                    label="Instagram"
                    placeholder="Enter instagram"
                    type="text"
                    value={linkInstagram}
                    onChange={(e) => setLinkInstagram(e.target.value)}
                />
                <Field
                    label="Facebook"
                    placeholder="Enter facebook"
                    type="text"
                    value={linkFacebook}
                    onChange={(e) => setLinkFacebook(e.target.value)}
                />
                <Field
                    label="Twitter"
                    placeholder="Enter twitter"
                    type="text"
                    value={linkTwitter}
                    onChange={(e) => setLinkTwitter(e.target.value)}
                />
                <Field
                    label="YouTube"
                    placeholder="Enter youTube"
                    type="text"
                    value={linkYouTube}
                    onChange={(e) => setLinkYouTube(e.target.value)}
                />
            </div>
        </Item>
    );
};

export default LinkAccount;
