import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { RatingStars } from './RatingStars'

describe('RatingStars', () => {
  it('renders five stars and reports the clicked value', () => {
    const onChange = vi.fn()
    render(<RatingStars value={2} onChange={onChange} />)
    const stars = screen.getAllByRole('button')
    expect(stars).toHaveLength(5)

    fireEvent.click(stars[3]) // 4th star
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('clears the rating when the current value is clicked again', () => {
    const onChange = vi.fn()
    render(<RatingStars value={3} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button')[2]) // 3rd star == current
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
