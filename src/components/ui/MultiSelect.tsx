import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"

interface Option {
  value: string
  label: string
}

interface MultiSelectProps {
  options: Option[]
  selected: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value]
    onChange(newSelected)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="flex flex-wrap gap-1">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selected.map((value) => {
                const option = options.find((o) => o.value === value)
                return (
                  <Badge key={value} variant="secondary">
                    {option?.label || value}
                  </Badge>
                )
              })
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[--radix-popover-trigger-width] p-0", className)}>
        <Command>
          <CommandInput placeholder="Pesquisar..." />
          <CommandList>
            <CommandEmpty>No item found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Checkbox
                    checked={selected.includes(option.value)}
                    onCheckedChange={() => handleSelect(option.value)}
                    className="mr-2"
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}