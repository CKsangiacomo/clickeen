'use client';

import { useState } from 'react';
import ConfiguratorIT from '@/app/widgets/contact-form/ConfiguratorIT';

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
        {copied ? 'Copiato!' : 'Copia'}
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
      setError('Inserisci la tua email');
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
        throw new Error(errorData.error || 'Impossibile generare lo snippet');
      }

      const { publicId, publicKey } = await response.json();
      setGeneratedPublicId(publicId);
      
      const snippet = `<div id="ckeen-${publicKey}"></div>
<script async src="https://c-keen-embed.vercel.app/api/e/${publicKey}?v=1"></script>`;
      
      setGeneratedSnippet(snippet);
      // Minimal hint (dev console) for direct form smoke
      console.log('PublicId for form POST:', publicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Qualcosa è andato storto');
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
              La tua email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tua@email.com"
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
            {isLoading ? 'Generando...' : 'Ottieni Snippet'}
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
            Vuoi modificarlo e salvarlo? Puoi creare un account più tardi — il widget funziona subito.
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
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', color: '#1a1a1a' }}>Demo dal vivo</h2>
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
      <ConfiguratorIT />

      {/* Why It's Faster */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', color: '#1a1a1a' }}>Perché è più veloce</h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#007bff', borderRadius: '50%' }}></div>
            <span style={{ fontSize: '1.1rem' }}>Payload limitato a 28 KB</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#007bff', borderRadius: '50%' }}></div>
            <span style={{ fontSize: '1.1rem' }}>Distribuito via Edge e cache immutabile</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#007bff', borderRadius: '50%' }}></div>
            <span style={{ fontSize: '1.1rem' }}>Nessun iframe pesante al caricamento</span>
          </div>
        </div>
      </section>

      {/* Get Your Snippet */}
      <section id="snippet" style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', color: '#1a1a1a' }}>Ottieni il tuo snippet</h2>
        <GetSnippetBox />
        
        <h3 style={{ fontSize: '1.4rem', marginTop: '48px', marginBottom: '24px', color: '#1a1a1a' }}>Snippet demo</h3>
        <SnippetBox publicId={PUBLIC_ID} version={EMBED_VERSION} isDev={isDev} />
      </section>

      {/* Customization */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', color: '#1a1a1a' }}>Personalizzazione</h2>
        <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: '#666' }}>
          Il widget si adatta automaticamente al tema del tuo sito. Personalizza colori, font e comportamento tramite la nostra dashboard o API.
        </p>
      </section>

      {/* Accessibility & Privacy */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', color: '#1a1a1a' }}>Accessibilità e Privacy</h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#1a1a1a' }}>Accessibilità</h3>
            <p style={{ color: '#666', lineHeight: '1.6' }}>
              Navigazione da tastiera, etichette ARIA, rispetta le preferenze 'riduci movimento'.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#1a1a1a' }}>Privacy</h3>
            <p style={{ color: '#666', lineHeight: '1.6' }}>
              Nessun tracker nello script; analytics anonimi opzionali.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', color: '#1a1a1a' }}>FAQ</h2>
        <div style={{ display: 'grid', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#1a1a1a' }}>Quanto è veloce?</h3>
            <p style={{ color: '#666', lineHeight: '1.6' }}>
              Il widget si carica in meno di 100ms ed è memorizzato globalmente via CDN.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#1a1a1a' }}>È conforme al GDPR?</h3>
            <p style={{ color: '#666', lineHeight: '1.6' }}>
              Sì, raccogliamo solo i dati che permetti esplicitamente e forniamo esportazione/cancellazione completa dei dati.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#1a1a1a' }}>Posso personalizzare lo stile?</h3>
            <p style={{ color: '#666', lineHeight: '1.6' }}>
              Assolutamente. Usa le proprietà CSS personalizzate o la nostra dashboard per abbinare il tuo brand.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '16px', color: '#1a1a1a' }}>Pronto a iniziare?</h2>
        <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '24px' }}>
          Unisciti a migliaia di sviluppatori che usano i widget Clickeen.
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
          Inizia gratis
        </a>
      </section>
    </main>
  );
}
