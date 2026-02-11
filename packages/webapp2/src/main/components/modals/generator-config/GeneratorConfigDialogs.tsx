import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { JSONSchemaConfig, QiskitConfig, SQLAlchemyConfig, SQLConfig } from '../../../services/generate-code/useGenerateCode';
import type { ConfigDialog } from '../../../services/generate-code/generator-dialog-config';

interface GeneratorConfigDialogsProps {
  configDialog: ConfigDialog;
  setConfigDialog: (dialog: ConfigDialog) => void;
  isLocalEnvironment: boolean;
  djangoProjectName: string;
  djangoAppName: string;
  useDocker: boolean;
  sqlDialect: SQLConfig['dialect'];
  sqlAlchemyDbms: SQLAlchemyConfig['dbms'];
  jsonSchemaMode: JSONSchemaConfig['mode'];
  sourceLanguage: string;
  pendingAgentLanguage: string;
  selectedAgentLanguages: string[];
  qiskitBackend: QiskitConfig['backend'];
  qiskitShots: number;
  onDjangoProjectNameChange: (value: string) => void;
  onDjangoAppNameChange: (value: string) => void;
  onUseDockerChange: (value: boolean) => void;
  onSqlDialectChange: (value: SQLConfig['dialect']) => void;
  onSqlAlchemyDbmsChange: (value: SQLAlchemyConfig['dbms']) => void;
  onJsonSchemaModeChange: (value: JSONSchemaConfig['mode']) => void;
  onSourceLanguageChange: (value: string) => void;
  onPendingAgentLanguageChange: (value: string) => void;
  onSelectedAgentLanguagesChange: (value: string[]) => void;
  onQiskitBackendChange: (value: QiskitConfig['backend']) => void;
  onQiskitShotsChange: (value: number) => void;
  onDjangoGenerate: () => void;
  onDjangoDeploy: () => void;
  onSqlGenerate: () => void;
  onSqlAlchemyGenerate: () => void;
  onJsonSchemaGenerate: () => void;
  onAgentGenerate: () => void;
  onQiskitGenerate: () => void;
}

const closeDialog = (setConfigDialog: (dialog: ConfigDialog) => void): void => {
  setConfigDialog('none');
};

export const GeneratorConfigDialogs: React.FC<GeneratorConfigDialogsProps> = ({
  configDialog,
  setConfigDialog,
  isLocalEnvironment,
  djangoProjectName,
  djangoAppName,
  useDocker,
  sqlDialect,
  sqlAlchemyDbms,
  jsonSchemaMode,
  sourceLanguage,
  pendingAgentLanguage,
  selectedAgentLanguages,
  qiskitBackend,
  qiskitShots,
  onDjangoProjectNameChange,
  onDjangoAppNameChange,
  onUseDockerChange,
  onSqlDialectChange,
  onSqlAlchemyDbmsChange,
  onJsonSchemaModeChange,
  onSourceLanguageChange,
  onPendingAgentLanguageChange,
  onSelectedAgentLanguagesChange,
  onQiskitBackendChange,
  onQiskitShotsChange,
  onDjangoGenerate,
  onDjangoDeploy,
  onSqlGenerate,
  onSqlAlchemyGenerate,
  onJsonSchemaGenerate,
  onAgentGenerate,
  onQiskitGenerate,
}) => {
  return (
    <>
      <Dialog open={configDialog === 'django'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Django Project Configuration</DialogTitle>
            <DialogDescription>Configure names and containerization options for Django generation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="django-project-name">Project Name</Label>
              <Input
                id="django-project-name"
                value={djangoProjectName}
                onChange={(event) => onDjangoProjectNameChange(event.target.value.replace(/\s/g, '_'))}
                placeholder="my_django_project"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="django-app-name">App Name</Label>
              <Input
                id="django-app-name"
                value={djangoAppName}
                onChange={(event) => onDjangoAppNameChange(event.target.value.replace(/\s/g, '_'))}
                placeholder="my_app"
              />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm">
              Include Docker containerization
              <input type="checkbox" checked={useDocker} onChange={(event) => onUseDockerChange(event.target.checked)} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              Cancel
            </Button>
            <Button onClick={onDjangoGenerate}>Generate</Button>
            {isLocalEnvironment && (
              <Button variant="secondary" onClick={onDjangoDeploy}>
                Deploy
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'sql'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SQL Dialect Selection</DialogTitle>
            <DialogDescription>Choose the SQL dialect for generated DDL statements.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Dialect</Label>
            <Select value={sqlDialect} onValueChange={(value) => onSqlDialectChange(value as SQLConfig['dialect'])}>
              <SelectTrigger>
                <SelectValue placeholder="Select SQL dialect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sqlite">SQLite</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="mssql">MS SQL Server</SelectItem>
                <SelectItem value="mariadb">MariaDB</SelectItem>
                <SelectItem value="oracle">Oracle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              Cancel
            </Button>
            <Button onClick={onSqlGenerate}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'sqlalchemy'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SQLAlchemy DBMS Selection</DialogTitle>
            <DialogDescription>Choose the database system for generated SQLAlchemy code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>DBMS</Label>
            <Select
              value={sqlAlchemyDbms}
              onValueChange={(value) => onSqlAlchemyDbmsChange(value as SQLAlchemyConfig['dbms'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select DBMS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sqlite">SQLite</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="mssql">MS SQL Server</SelectItem>
                <SelectItem value="mariadb">MariaDB</SelectItem>
                <SelectItem value="oracle">Oracle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              Cancel
            </Button>
            <Button onClick={onSqlAlchemyGenerate}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'jsonschema'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>JSON Schema Mode</DialogTitle>
            <DialogDescription>Pick regular JSON schema or NGSI-LD smart data mode.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select value={jsonSchemaMode} onValueChange={(value) => onJsonSchemaModeChange(value as JSONSchemaConfig['mode'])}>
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular JSON Schema</SelectItem>
                <SelectItem value="smart_data">Smart Data Models</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              Cancel
            </Button>
            <Button onClick={onJsonSchemaGenerate}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'agent'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agent Language Selection</DialogTitle>
            <DialogDescription>Select source and target languages for agent translation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Source Language</Label>
              <Select value={sourceLanguage} onValueChange={onSourceLanguageChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="french">French</SelectItem>
                  <SelectItem value="german">German</SelectItem>
                  <SelectItem value="luxembourgish">Luxembourgish</SelectItem>
                  <SelectItem value="portuguese">Portuguese</SelectItem>
                  <SelectItem value="spanish">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Target Language</Label>
              <div className="flex gap-2">
                <Select value={pendingAgentLanguage} onValueChange={onPendingAgentLanguageChange}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select target language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="french">French</SelectItem>
                    <SelectItem value="german">German</SelectItem>
                    <SelectItem value="luxembourgish">Luxembourgish</SelectItem>
                    <SelectItem value="portuguese">Portuguese</SelectItem>
                    <SelectItem value="spanish">Spanish</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (pendingAgentLanguage === 'none' || selectedAgentLanguages.includes(pendingAgentLanguage)) {
                      return;
                    }
                    onSelectedAgentLanguagesChange([...selectedAgentLanguages, pendingAgentLanguage]);
                    onPendingAgentLanguageChange('none');
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            {selectedAgentLanguages.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Languages</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedAgentLanguages.map((language) => (
                    <button
                      key={language}
                      type="button"
                      className="rounded-full border border-border/80 bg-muted/30 px-3 py-1 text-xs hover:bg-muted/60"
                      onClick={() =>
                        onSelectedAgentLanguagesChange(selectedAgentLanguages.filter((entry) => entry !== language))
                      }
                    >
                      {language} x
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              Cancel
            </Button>
            <Button onClick={onAgentGenerate}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'qiskit'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Qiskit Backend Configuration</DialogTitle>
            <DialogDescription>Choose execution backend and number of shots.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Execution Backend</Label>
              <Select value={qiskitBackend} onValueChange={(value) => onQiskitBackendChange(value as QiskitConfig['backend'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select backend" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aer_simulator">Aer Simulator (Local)</SelectItem>
                  <SelectItem value="fake_backend">Mock Simulation (Noise Simulation)</SelectItem>
                  <SelectItem value="ibm_quantum">IBM Quantum (Real Hardware)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qiskit-shots">Number of Shots</Label>
              <Input
                id="qiskit-shots"
                type="number"
                min={1}
                max={100000}
                value={qiskitShots}
                onChange={(event) => onQiskitShotsChange(Math.max(1, Number(event.target.value || 1024)))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              Cancel
            </Button>
            <Button onClick={onQiskitGenerate}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
