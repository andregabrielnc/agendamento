import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  backgroundColor: '#f5f5f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  padding: '24px',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '48px 40px',
  maxWidth: '440px',
  width: '100%',
  textAlign: 'center',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
};

const iconStyle: React.CSSProperties = {
  fontSize: '48px',
  marginBottom: '16px',
  lineHeight: 1,
};

const messageStyle: React.CSSProperties = {
  fontSize: '18px',
  color: '#333333',
  lineHeight: 1.5,
  margin: '0 0 28px 0',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#1a73e8',
  color: '#ffffff',
  border: 'none',
  borderRadius: '8px',
  padding: '12px 32px',
  fontSize: '15px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 0.2s',
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={containerStyle}>
          <div style={cardStyle}>
            <div style={iconStyle} role="img" aria-label="Aviso">
              &#9888;
            </div>
            <p style={messageStyle}>
              Algo deu errado. Por favor, recarregue a p&aacute;gina.
            </p>
            <button
              style={buttonStyle}
              onClick={this.handleReload}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1557b0';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1a73e8';
              }}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
