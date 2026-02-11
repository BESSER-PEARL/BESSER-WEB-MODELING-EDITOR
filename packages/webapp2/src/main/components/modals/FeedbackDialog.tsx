import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BACKEND_URL } from '../../constant';

type Satisfaction = 'happy' | 'neutral' | 'sad';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  { value: '', label: 'Select a category (optional)' },
  { value: 'editor', label: 'Diagram Editor' },
  { value: 'generators', label: 'Code Generation' },
  { value: 'deployment', label: 'Deployment' },
  { value: 'performance', label: 'Performance' },
  { value: 'bugs', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'other', label: 'Other' },
];

const satisfactionOptions: Array<{ value: Satisfaction; label: string; helper: string }> = [
  { value: 'sad', label: 'Not Satisfied', helper: 'Needs improvements' },
  { value: 'neutral', label: 'Neutral', helper: 'Mixed experience' },
  { value: 'happy', label: 'Very Satisfied', helper: 'Great experience' },
];

const buttonClass = (selected: boolean): string =>
  selected
    ? 'border-primary bg-primary/10 text-foreground'
    : 'border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground';

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ open, onOpenChange }) => {
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null);
  const [category, setCategory] = useState('');
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => Boolean(satisfaction) && feedback.trim().length > 0 && !isSubmitting, [feedback, isSubmitting, satisfaction]);

  const reset = () => {
    setSatisfaction(null);
    setCategory('');
    setFeedback('');
    setEmail('');
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      reset();
    }
  };

  const handleSubmit = async () => {
    if (!satisfaction || !feedback.trim()) {
      toast.error('Please provide a satisfaction rating and feedback.');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${BACKEND_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          satisfaction,
          category,
          feedback: feedback.trim(),
          email: email.trim() || null,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        let detail = 'Failed to submit feedback.';
        try {
          const payload = await response.json();
          if (typeof payload?.detail === 'string') {
            detail = payload.detail;
          }
        } catch {
          // Use fallback detail.
        }
        throw new Error(detail);
      }

      toast.success('Thank you for your feedback.');
      handleOpenChange(false);
    } catch (error) {
      toast.error(`Feedback submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Help Us Improve BESSER</DialogTitle>
          <DialogDescription>Share your feedback about the editor and generation workflow.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>How satisfied are you with your experience?</Label>
            <div className="grid gap-2 md:grid-cols-3">
              {satisfactionOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSatisfaction(option.value)}
                  className={`rounded-lg border px-3 py-3 text-left transition ${buttonClass(satisfaction === option.value)}`}
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs opacity-80">{option.helper}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-category">Category</Label>
            <select
              id="feedback-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {categories.map((option) => (
                <option key={option.value || 'none'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-message">
              Feedback <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="feedback-message"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Tell us what works, what does not, and what you want next."
              className="min-h-28"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-email">Email (optional)</Label>
            <Input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your.email@example.com"
            />
            <p className="text-xs text-muted-foreground">Leave your email if you want follow-up from the team.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
