import React, { useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
type FAQWidgetSectionProps = {
  title?: string;
  description?: string;
  demoUrl?: string;
};

// @component: FAQWidgetSection
export const FAQWidgetSection = ({
  title = "Create your FAQ widget",
  description = "Configure your widget and add it to your website for free!",
  demoUrl = "https://dash.elfsight.com/demo/faq"
}: FAQWidgetSectionProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = () => {
    // In a real implementation, this might trigger the Fullscreen API for the container element
    setIsFullscreen(!isFullscreen);
  };

  // Specific gradient from the design
  const backgroundStyle = {
    backgroundImage: `
      linear-gradient(0deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.08) 100%),
      linear-gradient(90deg, rgb(168, 63, 190) -20.16%, rgb(253, 52, 89) 49.45%, rgb(255, 199, 63) 112.16%)
    `
  };

  // @return
  return <section className="relative w-full overflow-hidden text-white box-border py-20 px-5" style={backgroundStyle}>
      <div className="relative mx-auto max-w-[1310px] px-5 mb-15">
        <div className="mx-auto max-w-[830px] text-center">
          <h2 className="text-[40px] font-bold leading-[48px] m-0 text-white text-balance">
            {title}
          </h2>
          <div className="mt-5 text-[20px] leading-[28px] text-white text-balance">
            {description}
          </div>
        </div>
      </div>

      <div className="mt-[60px] flex justify-center">
        <div className={`
            relative w-full max-w-[1800px] transition-all duration-300 ease-in-out
            ${isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen max-w-none bg-black/90 p-4 flex items-center justify-center' : ''}
          `}>
          <div className={`
              relative bg-white rounded-2xl overflow-hidden shadow-[0_20px_40px_0_rgba(0,0,0,0.4)]
              ${isFullscreen ? 'w-full h-full' : 'h-[600px] md:h-[900px]'}
            `}>
            {/* Control Buttons */}
            <div className="absolute top-3 right-3 z-10 flex gap-2">
              {!isFullscreen ? <button onClick={toggleFullscreen} className="flex items-center justify-center w-9 h-9 bg-transparent hover:bg-gray-100/10 rounded-md cursor-pointer transition-colors group" title="Full Screen" aria-label="Enter Full Screen">
                  <Maximize className="w-6 h-6 text-gray-800/50 group-hover:text-gray-800 transition-colors" />
                </button> : <button onClick={toggleFullscreen} className="flex items-center justify-center w-9 h-9 bg-transparent hover:bg-gray-100/10 rounded-md cursor-pointer transition-colors group" title="Exit Full Screen" aria-label="Exit Full Screen">
                  <Minimize className="w-6 h-6 text-gray-800/50 group-hover:text-gray-800 transition-colors" />
                </button>}
            </div>

            {/* Iframe Wrapper */}
            <div className="w-full h-full bg-white relative">
              <iframe title={title} src={demoUrl} className="block w-full h-full border-0" loading="lazy" allow="autoplay; fullscreen" />
            </div>
          </div>
        </div>
      </div>
    </section>;
};