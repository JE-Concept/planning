/**
 * De oude componentnamen, nu op het design system.
 *
 * Er stonden twee sets naast elkaar: deze, met eigen kleuren in Tailwind-klassen,
 * en die van het JE Concept Design System. Zo krijgt een app twee huisstijlen —
 * en mist een kleurwijziging op één plek de helft van de schermen.
 *
 * Er is er nu nog één. Dit bestand vertaalt alleen: dertig schermen importeren
 * hun `Button` en `Badge` hiervandaan, en die hoeven daar niet allemaal voor
 * aangeraakt te worden. Wat hier staat is de vertaling van de oude namen en
 * eigenschappen naar `@components/ds`, verder niets.
 *
 * Schrijf je iets nieuws, importeer dan rechtstreeks uit `@components/ds`.
 */

import { forwardRef } from 'react'
import {
  Avatar as DsAvatar,
  AvatarStack as DsAvatarStack,
  Badge as DsBadge,
  Button as DsButton,
  ConfirmButton as DsConfirmButton,
  Dialog,
  Dot as DsDot,
  Drawer as DsDrawer,
  EmptyState as DsEmptyState,
  Field as DsField,
  Input as DsInput,
  ProgressBar as DsProgressBar,
  Select as DsSelect,
  Spinner as DsSpinner,
  Textarea as DsTextarea,
} from '@components/ds'

/** De oude standaard was "secondary"; die van het systeem is "primary". */
export const Button = forwardRef(function Button({ variant = 'secondary', size = 'md', ...rest }, ref) {
  return <DsButton ref={ref} variant={variant} size={size} {...rest} />
})

export const Input = forwardRef(function Input(props, ref) {
  return <DsInput ref={ref} {...props} />
})

export const Textarea = forwardRef(function Textarea(props, ref) {
  return <DsTextarea ref={ref} {...props} />
})

export const Select = forwardRef(function Select(props, ref) {
  return <DsSelect ref={ref} {...props} />
})

export function Field({ label, hint, children, className }) {
  return (
    <DsField label={label} hint={hint} className={className}>
      {children}
    </DsField>
  )
}

/**
 * De oude badge kreeg een kleur als hex, de nieuwe een toon uit het systeem.
 *
 * De kleur blijft werken — de statuskleuren van een bord komen uit de database
 * en zijn geen systeemtoon — maar zonder kleur valt ze terug op het systeem in
 * plaats van op een willekeurig grijs.
 */
export function Badge({ color, children, className, subtle = false, ...rest }) {
  const style = color
    ? subtle
      ? { background: `${color}1f`, color, borderColor: 'transparent' }
      : { background: color, color: 'var(--text-on-accent)', borderColor: 'transparent' }
    : undefined

  return (
    <DsBadge className={className} style={style} {...rest}>
      {children}
    </DsBadge>
  )
}

export const Dot = DsDot
export const Avatar = DsAvatar
export const AvatarStack = DsAvatarStack
export const Spinner = DsSpinner
export const EmptyState = DsEmptyState
export const ProgressBar = DsProgressBar
export const ConfirmButton = DsConfirmButton
export const Drawer = DsDrawer

/** De oude Modal is de Dialog van het systeem; `width` was een Tailwind-klasse. */
const BREEDTES = {
  'max-w-sm': 384,
  'max-w-md': 448,
  'max-w-lg': 512,
  'max-w-xl': 576,
  'max-w-2xl': 672,
  'max-w-3xl': 768,
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg', className }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={footer}
      width={BREEDTES[width] ?? width}
      className={className}
    >
      {children}
    </Dialog>
  )
}
