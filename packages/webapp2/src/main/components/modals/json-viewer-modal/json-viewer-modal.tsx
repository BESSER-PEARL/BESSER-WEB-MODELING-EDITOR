import React from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import hljs from 'highlight.js/lib/core';
import jsonLang from 'highlight.js/lib/languages/json';
import pythonLang from 'highlight.js/lib/languages/python';

if (!hljs.getLanguage('json')) {
  hljs.registerLanguage('json', jsonLang);
}

if (!hljs.getLanguage('python')) {
  hljs.registerLanguage('python', pythonLang);
}

const ModalOverlay = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  inset: 0;
  display: ${props => (props.$isVisible ? 'flex' : 'none')};
  align-items: center;
  justify-content: center;
  z-index: 99999;
  padding: 20px;
  background: rgba(2, 6, 23, 0.76);
  backdrop-filter: blur(2px);
`;

const ModalContent = styled.div`
  width: min(960px, 92vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid #1f2a44;
  background: linear-gradient(180deg, #0f172a 0%, #0b1326 100%);
  box-shadow: 0 28px 70px rgba(2, 6, 23, 0.68);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  border-bottom: 1px solid #1f2a44;

  h3 {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: #e2e8f0;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
  }
`;

const ModalSubtitle = styled.span`
  color: #93a7c7;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
`;

const CloseButton = styled.button`
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid #314062;
  background: #111d33;
  color: #b6c3db;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #4f6696;
    background: #172741;
    color: #e2e8f0;
  }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow: auto;
  padding: 16px 22px 20px;
`;

const TabSwitcher = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 14px;

  button {
    flex: 1;
    border: 1px solid #304364;
    background: #0f1b33;
    color: #b6c3db;
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  button:hover {
    border-color: #4f6696;
    color: #dbe7ff;
  }

  button.active {
    border-color: #60a5fa;
    color: #f8fbff;
    background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
    box-shadow: 0 8px 20px rgba(14, 165, 233, 0.28);
  }
`;

const PlaceholderBox = styled.div`
  border-radius: 10px;
  border: 1px dashed #314062;
  background: #0e1a32;
  color: #93a7c7;
  padding: 22px;
  font-size: 14px;
  text-align: center;
`;

const ErrorBox = styled.div`
  border-radius: 10px;
  border: 1px solid #ef4444;
  background: rgba(127, 29, 29, 0.4);
  color: #fecaca;
  padding: 16px;
  font-size: 14px;
  font-weight: 600;
`;

const CodeBlock = styled.pre`
  margin: 0;
  border-radius: 12px;
  border: 1px solid #263754;
  background: radial-gradient(120% 120% at 0% 0%, #0f1b33 0%, #0b1326 58%, #090f20 100%);
  color: #dbe5ff;
  padding: 18px;
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre;
  overflow: auto;

  code {
    display: block;
    min-width: max-content;
    background: transparent;
    color: inherit;
  }

  .hljs-keyword,
  .hljs-selector-tag,
  .hljs-literal {
    color: #ff7ab2;
  }

  .hljs-string,
  .hljs-title,
  .hljs-name,
  .hljs-attr {
    color: #a6da95;
  }

  .hljs-number,
  .hljs-symbol,
  .hljs-bullet {
    color: #f5a97f;
  }

  .hljs-built_in,
  .hljs-type,
  .hljs-attribute {
    color: #8aadf4;
  }

  .hljs-comment,
  .hljs-quote {
    color: #7f8aa3;
    font-style: italic;
  }

  .hljs-variable,
  .hljs-template-variable,
  .hljs-selector-attr {
    color: #eed49f;
  }

  .hljs-function,
  .hljs-title.function_ {
    color: #7dc4e4;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 16px 22px 18px;
  border-top: 1px solid #1f2a44;

  button {
    padding: 9px 14px;
    border-radius: 8px;
    border: 1px solid transparent;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .primary-button {
    border-color: #60a5fa;
    background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
    color: #f8fbff;
  }

  .primary-button:not(:disabled):hover {
    box-shadow: 0 8px 18px rgba(14, 165, 233, 0.3);
  }

  .secondary-button {
    border-color: #314062;
    background: #111d33;
    color: #d4def3;
  }

  .secondary-button:not(:disabled):hover {
    border-color: #4f6696;
    background: #172741;
  }
`;

interface JsonViewerModalProps {
  isVisible: boolean;
  jsonData: string;
  diagramType: string;
  onClose: () => void;
  onCopy: () => void;
  onDownload: () => void;
  enableBumlView?: boolean;
  bumlData?: string;
  bumlLabel?: string;
  isBumlLoading?: boolean;
  bumlError?: string;
  onRequestBuml?: () => void;
  onCopyBuml?: () => void;
  onDownloadBuml?: () => void;
}

type SupportedLanguage = 'json' | 'python';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const highlightCode = (code: string, language: SupportedLanguage): string => {
  if (!code) {
    return '';
  }

  try {
    return hljs.highlight(code, { language }).value;
  } catch (error) {
    console.warn('Failed to highlight code. Falling back to plain text.', error);
    return escapeHtml(code);
  }
};

const HighlightedCode: React.FC<{ code: string; language: SupportedLanguage }> = ({ code, language }) => {
  const highlightedMarkup = React.useMemo(() => highlightCode(code, language), [code, language]);

  return (
    <CodeBlock>
      <code className="hljs" dangerouslySetInnerHTML={{ __html: highlightedMarkup }} />
    </CodeBlock>
  );
};

export const JsonViewerModal: React.FC<JsonViewerModalProps> = ({
  isVisible,
  jsonData,
  diagramType,
  onClose,
  onCopy,
  onDownload,
  enableBumlView = false,
  bumlData,
  bumlLabel = 'Diagram B-UML',
  isBumlLoading = false,
  bumlError,
  onRequestBuml,
  onCopyBuml,
  onDownloadBuml,
}) => {
  const [activeTab, setActiveTab] = React.useState<'json' | 'buml'>('json');

  React.useEffect(() => {
    if (isVisible) {
      setActiveTab('json');
    }
  }, [isVisible]);

  const handleTabChange = (tab: 'json' | 'buml') => {
    setActiveTab(tab);
    if (tab === 'buml' && enableBumlView && onRequestBuml && !bumlData && !isBumlLoading) {
      onRequestBuml();
    }
  };

  if (!isVisible) {
    return null;
  }

  const isBumlView = enableBumlView && activeTab === 'buml';
  const headerTitle = isBumlView ? bumlLabel : 'Project JSON Preview';

  return createPortal(
    <ModalOverlay $isVisible={isVisible} onClick={onClose}>
      <ModalContent onClick={(event) => event.stopPropagation()}>
        <ModalHeader>
          <h3>
            {headerTitle}
            <ModalSubtitle>{diagramType}</ModalSubtitle>
          </h3>
          <CloseButton onClick={onClose} aria-label="Close preview modal">
            x
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          {enableBumlView && (
            <TabSwitcher>
              <button
                type="button"
                className={activeTab === 'json' ? 'active' : ''}
                onClick={() => handleTabChange('json')}
              >
                JSON
              </button>
              <button
                type="button"
                className={activeTab === 'buml' ? 'active' : ''}
                onClick={() => handleTabChange('buml')}
              >
                B-UML
              </button>
            </TabSwitcher>
          )}

          {isBumlView ? (
            <>
              {isBumlLoading && <PlaceholderBox>Generating B-UML preview...</PlaceholderBox>}
              {!isBumlLoading && bumlError && <ErrorBox>{bumlError}</ErrorBox>}
              {!isBumlLoading && !bumlError && bumlData && <HighlightedCode code={bumlData} language="python" />}
              {!isBumlLoading && !bumlError && !bumlData && (
                <PlaceholderBox>No B-UML preview is available yet.</PlaceholderBox>
              )}
            </>
          ) : (
            <HighlightedCode code={jsonData} language="json" />
          )}
        </ModalBody>

        <ModalFooter>
          {isBumlView ? (
            <>
              {onRequestBuml && (
                <button
                  className="secondary-button"
                  onClick={onRequestBuml}
                  disabled={isBumlLoading}
                >
                  {isBumlLoading ? 'Generating...' : 'Regenerate'}
                </button>
              )}
              {onDownloadBuml && (
                <button
                  className="secondary-button"
                  onClick={onDownloadBuml}
                  disabled={isBumlLoading || !bumlData}
                >
                  Download B-UML
                </button>
              )}
              {onCopyBuml && (
                <button
                  className="primary-button"
                  onClick={onCopyBuml}
                  disabled={isBumlLoading || !bumlData}
                >
                  Copy B-UML
                </button>
              )}
            </>
          ) : (
            <>
              <button className="secondary-button" onClick={onDownload}>
                Download JSON
              </button>
              <button className="primary-button" onClick={onCopy}>
                Copy JSON
              </button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>,
    document.body,
  );
};
