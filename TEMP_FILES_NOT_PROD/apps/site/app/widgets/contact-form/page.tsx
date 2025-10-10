'use client';

import { useState } from 'react';
import Configurator from './Configurator';

// Client component for the snippet box
function SnippetBox({ publicId, version, isDev }: { publicId: string; version: number; isDev: boolean }) {
  const [copied, setCopied] = useState(false);
  
  const scriptSrc = isDev 
    ? `http://localhost:3002/api/e/${publicId}`
    : `https://c-keen-embed.vercel.app/api/e/${publicId}?v=${version}`;
  
  const snippet = `<div id="ckeen-${publicId}"></div>
<script async defer src="${scriptSrc}"></script>`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ margin: '24px 0' }}>
      <textarea
        value={snippet}
        readOnly
        style={{
          width: '100%',
          minHeight: '80px',
          fontFamily: 'monospace',
          fontSize: '14px',
          padding: '12px',
          border: '1px solid #e1e5e9',
          borderRadius: '8px',
          backgroundColor: '#f8f9fa',
          resize: 'vertical'
        }}
      />
      <button
        onClick={copyToClipboard}
        style={{
          marginTop: '8px',
          padding: '8px 16px',
          backgroundColor: copied ? '#28a745' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

// Client component for email capture and snippet generation
function GetSnippetBox() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedSnippet, setGeneratedSnippet] = useState('');
  const [generatedPublicId, setGeneratedPublicId] = useState('');

  const handleGetSnippet = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/widgets/anonymous', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          type: 'contact-form',
          config: {
            // Default config for preview
            theme: 'light',
            position: 'bottom-right'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate snippet');
      }

      const { publicId } = await response.json();
      setGeneratedPublicId(publicId);
      
      const snippet = `<div id="ckeen-${publicId}"></div>
<script async src="https://c-keen-embed.vercel.app/api/e/${publicId}?v=1"></script>`;
      
      setGeneratedSnippet(snippet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ margin: '24px 0' }}>
      {!generatedSnippet ? (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Your email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
          <button
            onClick={handleGetSnippet}
            disabled={isLoading}
            style={{
              padding: '12px 24px',
              backgroundColor: isLoading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {isLoading ? 'Generating...' : 'Get Snippet'}
          </button>
        </div>
      ) : (
        <div>
          <textarea
            value={generatedSnippet}
            readOnly
            style={{
              width: '100%',
              minHeight: '80px',
              fontFamily: 'monospace',
              fontSize: '14px',
              padding: '12px',
              border: '1px solid #e1e5e9',
              borderRadius: '8px',
              backgroundColor: '#f8f9fa',
              resize: 'vertical'
            }}
          />
          <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
            Want to edit and save it? You can create an account later — the widget works right now.
          </p>
        </div>
      )}
      {error && (
        <p style={{ color: '#dc3545', fontSize: '14px', marginTop: '8px' }}>
          {error}
        </p>
      )}
    </div>
  );
}

const PUBLIC_ID = process.env.DEMO_PUBLIC_ID || 'DEMO';
const EMBED_VERSION = Number(process.env.EMBED_VERSION) || 1;
const isDev = process.env.NODE_ENV === 'development';

export default function Page() {
  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      {/* Live Demo */}
      <section id="demo" style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', color: '#1a1a1a' }}>Live Demo</h2>
        <div 
          id={`ckeen-${PUBLIC_ID}`}
          style={{ 
            border: '1px solid #e1e5e9', 
            borderRadius: '8px', 
            padding: '24px',
            backgroundColor: '#f8f9fa'
          }}
        ></div>
        <script 
          async 
          defer 
          src={isDev 
            ? `http://localhost:3002/api/e/${PUBLIC_ID}`
            : `https://c-keen-embed.vercel.app/api/e/${PUBLIC_ID}?v=${EMBED_VERSION}`
          }
        />
      </section>

      {/* Widget Configurator */}
      <Configurator />

      {/* Why It's Faster */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', color: '#1a1a1a' }}>Why It's Faster</h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#007bff', borderRadius: '50%' }}></div>
            <span style={{ fontSize: '1.1rem' }}>Payload limited to 28 KB</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#007bff', borderRadius: '50%' }}></div>
            <span style={{ fontSize: '1.1rem' }}>Distributed via Edge and immutable cache</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#007bff', borderRadius: '50%' }}></div>
            <span style={{ fontSize: '1.1rem' }}>No heavy iframe on load</span>
          </div>
        </div>
      </section>

      {/* Copy-paste Snippet */}
      <section id="snippet" style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', color: '#1a1a1a' }}>Get Your Snippet</h2>
        <GetSnippetBox />
        
        <h3 style={{ fontSize: '1.4rem', marginTop: '48px', marginBottom: '24px', color: '#1a1a1a' }}>Demo Snippet</h3>
        <SnippetBox publicId={PUBLIC_ID} version={EMBED_VERSION} isDev={isDev} />
      </section>

      {/* Customization */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', color: '#1a1a1a' }}>Customization</h2>
        <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: '#666' }}>
          The widget automatically adapts to your site's theme. Customize colors, fonts, and behavior through our dashboard or API.
        </p>
      </section>

      {/* Accessibility & Privacy */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', color: '#1a1a1a' }}>Accessibility & Privacy</h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#1a1a1a' }}>Accessibility</h3>
            <p style={{ color: '#666', lineHeight: '1.6' }}>
              Keyboard navigation, ARIA labels, respects 'reduce motion' preferences.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#1a1a1a' }}>Privacy</h3>
            <p style={{ color: '#666', lineHeight: '1.6' }}>
              No trackers in the script; anonymous analytics optional.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', color: '#1a1a1a' }}>FAQ</h2>
        <div style={{ display: 'grid', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#1a1a1a' }}>How fast is it?</h3>
            <p style={{ color: '#666', lineHeight: '1.6' }}>
              The widget loads in under 100ms and is cached globally via CDN.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#1a1a1a' }}>Is it GDPR compliant?</h3>
            <p style={{ color: '#666', lineHeight: '1.6' }}>
              Yes, we only collect data you explicitly allow and provide full data export/deletion.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#1a1a1a' }}>Can I customize the styling?</h3>
            <p style={{ color: '#666', lineHeight: '1.6' }}>
              Absolutely. Use CSS custom properties or our dashboard to match your brand.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '16px', color: '#1a1a1a' }}>Ready to get started?</h2>
        <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '24px' }}>
          Join thousands of developers using Clickeen widgets.
        </p>
        <a 
          href="/dashboard" 
          style={{
            padding: '16px 32px',
            backgroundColor: '#007bff',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '1.1rem'
          }}
        >
          Get Started Free
        </a>
      </section>
    </main>
  );
}
