import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, MessageCircleQuestion, Sparkles, Plus, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
type FAQItem = {
  id: string;
  question: string;
  answer: string;
  category?: string;
};
const INITIAL_FAQS: FAQItem[] = [{
  id: '1',
  category: 'General',
  question: 'What is this FAQ widget?',
  answer: 'This is a fully responsive, accessible, and customizable FAQ accordion component built with React, Tailwind CSS, and Framer Motion. It features smooth animations, search functionality, and a clean modern design.'
}, {
  id: '2',
  category: 'Billing',
  question: 'How does the billing work?',
  answer: 'We offer flexible billing options including monthly and annual subscriptions. You can upgrade, downgrade, or cancel your plan at any time directly from your dashboard without any hidden fees.'
}, {
  id: '3',
  category: 'General',
  question: 'Is technical support included?',
  answer: 'Yes! All plans come with standard email support. Premium and Enterprise plans also include priority support with faster response times and dedicated account managers.'
}, {
  id: '4',
  category: 'Technical',
  question: 'Can I integrate this into my existing website?',
  answer: 'Absolutely. The widget is designed to be framework-agnostic in its usage patterns, though it is built with React. It drops easily into any React application and can be styled to match your brand.'
}, {
  id: '5',
  category: 'Technical',
  question: 'Does it support dark mode?',
  answer: 'Yes, the component is built with Tailwind CSS dark mode classes. It automatically adapts to your application\'s theme settings, ensuring a consistent look and feel across all environments.'
}, {
  id: '6',
  category: 'Billing',
  question: 'What payment methods do you accept?',
  answer: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and wire transfers for enterprise accounts. All payments are processed securely via Stripe.'
}];
const CATEGORIES = ['All', 'General', 'Billing', 'Technical'];

// @component: FAQAccordion
export const FAQAccordion = () => {
  const [activeId, setActiveId] = useState<string | null>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const filteredFAQs = INITIAL_FAQS.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  const toggleItem = (id: string) => {
    setActiveId(activeId === id ? null : id);
  };

  // @return
  return <div className="w-full max-w-3xl mx-auto p-6 md:p-8 bg-background/50 rounded-3xl border border-border/50 shadow-sm backdrop-blur-xl">
      {/* Header Section */}
      <div className="text-center mb-10 space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-2">
          <MessageCircleQuestion className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          Frequently Asked Questions
        </h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Everything you need to know about the product and billing. Can't find the answer you're looking for? Please chat to our friendly team.
        </p>
      </div>

      {/* Search and Filter Section */}
      <div className="mb-8 space-y-6">
        {/* Search Input */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <Search className="h-5 w-5" />
          </div>
          <input type="text" className="block w-full pl-11 pr-4 py-4 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm hover:shadow-md" placeholder="Search for answers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 justify-center">
          {CATEGORIES.map(category => <button key={category} onClick={() => setSelectedCategory(category)} className={cn("px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ease-in-out border", selectedCategory === category ? "bg-primary text-primary-foreground border-primary shadow-md transform scale-105" : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:bg-primary/5")}>
              {category}
            </button>)}
        </div>
      </div>

      {/* FAQ List */}
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {filteredFAQs.length > 0 ? <div className="space-y-4">
              {filteredFAQs.map(faq => <motion.div key={faq.id} initial={{
            opacity: 0,
            y: 10
          }} animate={{
            opacity: 1,
            y: 0
          }} exit={{
            opacity: 0,
            scale: 0.95
          }} transition={{
            duration: 0.2
          }} className={cn("group rounded-xl border border-border bg-card transition-all duration-300 ease-in-out overflow-hidden", activeId === faq.id ? "ring-2 ring-primary/10 shadow-lg border-primary/20" : "hover:border-primary/30 hover:shadow-md")}>
                  <button onClick={() => toggleItem(faq.id)} className="w-full flex items-center justify-between p-5 text-left focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-inset rounded-xl">
                    <span className="flex-1 text-lg font-semibold text-foreground pr-4 group-hover:text-primary transition-colors">
                      {faq.question}
                    </span>
                    <span className={cn("flex-shrink-0 ml-4 p-2 rounded-full border transition-all duration-300", activeId === faq.id ? "bg-primary text-primary-foreground border-primary rotate-180" : "bg-background text-muted-foreground border-border group-hover:border-primary/50 group-hover:text-primary")}>
                      {activeId === faq.id ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </span>
                  </button>
                  
                  <AnimatePresence>
                    {activeId === faq.id && <motion.div initial={{
                height: 0,
                opacity: 0
              }} animate={{
                height: "auto",
                opacity: 1
              }} exit={{
                height: 0,
                opacity: 0
              }} transition={{
                duration: 0.3,
                ease: [0.04, 0.62, 0.23, 0.98]
              }}>
                        <div className="px-5 pb-5 pt-0">
                          <div className="h-px w-full bg-border/50 mb-4" />
                          <p className="text-muted-foreground leading-relaxed">
                            {faq.answer}
                          </p>
                          {faq.category && <div className="mt-4 flex items-center gap-2">
                              <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground">
                                {faq.category}
                              </span>
                            </div>}
                        </div>
                      </motion.div>}
                  </AnimatePresence>
                </motion.div>)}
            </div> : <motion.div initial={{
          opacity: 0,
          scale: 0.9
        }} animate={{
          opacity: 1,
          scale: 1
        }} className="text-center py-12 px-4 rounded-2xl bg-muted/30 border border-dashed border-border">
              <div className="inline-flex justify-center items-center w-12 h-12 rounded-full bg-muted mb-4">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">No results found</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">
                We couldn't find any FAQs matching "{searchQuery}". Try adjusting your search terms or category.
              </p>
              <button onClick={() => {
            setSearchQuery('');
            setSelectedCategory('All');
          }} className="mt-4 text-primary font-medium hover:underline text-sm">
                Clear all filters
              </button>
            </motion.div>}
        </AnimatePresence>
      </div>

      {/* Footer / CTA */}
      <div className="mt-10 pt-6 border-t border-border text-center">
        <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/5 rounded-full text-sm text-primary font-medium border border-primary/10">
          <Sparkles className="w-4 h-4" />
          <span>Still have questions?</span>
        </div>
        <p className="mt-4 text-muted-foreground text-sm">
          Contact our support team at <a href="#" className="text-primary hover:underline font-medium">support@example.com</a>
        </p>
      </div>
    </div>;
};