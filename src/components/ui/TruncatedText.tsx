import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TruncatedTextProps {
  text: string;
  maxLength?: number;
  className?: string;
}

export const TruncatedText: React.FC<TruncatedTextProps> = ({ 
  text, 
  maxLength = 20, 
  className = '' 
}) => {
  const shouldTruncate = text && text.length > maxLength;
  const displayText = shouldTruncate ? `${text.substring(0, maxLength)}...` : text;

  if (shouldTruncate) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`cursor-help ${className}`}>
              {displayText}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs break-words">{text}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <span className={className}>{displayText}</span>;
};
