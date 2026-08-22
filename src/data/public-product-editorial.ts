export type PublicProductEditorial = {
  selectionGuidance: string;
  projectGuidance: string;
  comparisonGuidance: string;
  considerationReplacements?: Record<string, string>;
};

export const publicProductEditorial: Record<string, PublicProductEditorial> = {
  'WRP-W001': {
    selectionGuidance: 'Choose this casement direction when a clear glass area and controllable ventilation matter more than a sliding track. The side-hinged sash closes against compression seals, but it needs enough exterior space to swing freely.',
    projectGuidance: 'Measure the opening and check sash clearance, crank access, room use and exterior exposure together. Glazing, handing, frame depth and the installation method then define the appropriate casement configuration.',
    comparisonGuidance: 'Compare it with the deeper casement when documented exposure ratings matter, or with an awning when a top hinge better suits the opening.'
  },
  'WRP-W002': {
    selectionGuidance: 'This deeper casement direction is intended for openings where frame depth and documented air, water, structural or thermal performance deserve closer attention. It retains crank operation and a compression close while allowing a more performance-led specification.',
    projectGuidance: 'Confirm wall depth, jamb and trim conditions, sash clearance, elevation exposure and the required tested ratings before selecting the frame. Ratings must remain tied to the measured size, glazing package and exact operating configuration.',
    comparisonGuidance: 'Compare it with the slimmer casement when glass area and a compact frame are the priority, not simply by appearance.'
  },
  'WRP-W003': {
    selectionGuidance: 'An awning sash is hinged at the top and opens outward from the bottom, making it useful for compact ventilation or placement above and below fixed glass. Its projection and hardware reach need to work with the wall height and exterior surroundings.',
    projectGuidance: 'Check sill height, crank reach, exterior clearance and whether the opening contributes to egress. Frame depth, glazing and combination mullions are coordinated after the opening and adjacent fixed sections are measured.',
    comparisonGuidance: 'Compare it with a casement for taller directed ventilation, and with a fixed window when ventilation is unnecessary.'
  },
  'WRP-W004': {
    selectionGuidance: 'Two vertically moving sashes allow ventilation at the upper sash, lower sash or both. This operation suits traditional proportions and avoids exterior projection, while the centre meeting rail and sash reach remain visible practical differences.',
    projectGuidance: 'Measure the opening, confirm reachable sash heights and review screen, balance and cleaning access. Glazing, exposure ratings and installation details must match the quoted double-hung size rather than a generic style label.',
    comparisonGuidance: 'Compare it with a single-hung window when one moving sash is enough, or with a double slider when the opening is wider than it is tall.'
  },
  'WRP-W005': {
    selectionGuidance: 'A single-hung window keeps one vertical sash fixed while the companion sash provides ventilation. It preserves familiar upright proportions with fewer moving parts than a double-hung window, but it cannot ventilate from both the top and bottom.',
    projectGuidance: 'Confirm which sash operates, the reachable handle height, screen arrangement and required clear opening. The measured width and height determine whether the ventilation area and any egress requirement can be met.',
    comparisonGuidance: 'Compare it with double hung for two-sash ventilation and with single slider only when horizontal operation better fits the wall opening.'
  },
  'WRP-W006': {
    selectionGuidance: 'Both sashes move horizontally, so ventilation can be taken from either side without projecting onto a deck, path or room. The centre meeting rail, track condition and screen arrangement are more important here than crank hardware.',
    projectGuidance: 'Measure the wider opening, identify preferred ventilation sides and confirm sash-removal or cleaning access. Track drainage, locks, glazing and tested performance are selected for the final width and panel proportions.',
    comparisonGuidance: 'Compare it with a single slider when only one operating side is needed, and with hung windows when vertical proportions suit the elevation better.'
  },
  'WRP-W007': {
    selectionGuidance: 'One sash travels horizontally beside a fixed section, providing simple ventilation with no exterior swing. It works well where the opening is wider than tall and where access to the track for routine cleaning is practical.',
    projectGuidance: 'Confirm the operating side, furniture layout, screen position, clear opening and drainage path. The measured span, glazing choice and exposure determine the frame and sash configuration.',
    comparisonGuidance: 'Compare it with a double slider for ventilation from either side; compare it with single hung when an upright opening and vertical airflow are more suitable.'
  },
  'WRP-W008': {
    selectionGuidance: 'A picture window is fixed, with no sash hardware or ventilation function. Its purpose is broad daylight and an open view, either as a standalone opening or as the visual centre of a combination.',
    projectGuidance: 'Measure glass size, wall support and access for handling, then confirm safety-glass requirements and exposure. Adjacent operating units should be coordinated for compatible frame depth, glass lines and mullion details.',
    comparisonGuidance: 'Compare it with casement-profile fixed when matching nearby crank windows matters, or add operating units when the room still requires ventilation.'
  },
  'WRP-W009': {
    selectionGuidance: 'This fixed window uses a sash-like profile intended to align with adjacent casement or awning units. It gives up ventilation to keep combination sightlines more consistent than a conventional picture-window frame may allow.',
    projectGuidance: 'Confirm the exact adjoining operating series, frame depth, glass line and mullion layout before ordering. Combination size, structural support and glazing must be reviewed as one assembled opening.',
    comparisonGuidance: 'Compare it with a picture window for simpler fixed glazing, and with a slim fixed profile when maximum visible glass matters more than matching an operating sash.'
  },
  'WRP-W010': {
    selectionGuidance: 'The slim fixed direction reduces visible perimeter framing to emphasize glass area in a non-operating opening. It suits contemporary compositions where daylight and restrained sightlines are the goals, not ventilation.',
    projectGuidance: 'Measure the opening and establish glass size, safety requirements, frame depth and support for installation. When combined with other windows, align perimeter profiles and mullions rather than assuming every slim frame is compatible.',
    comparisonGuidance: 'Compare it with a picture window for general fixed use and with casement-profile fixed when matching adjacent crank-operated units is the stronger priority.'
  },
  'WRP-D001': {
    selectionGuidance: 'Two defined panel fields create a balanced solid-door face with full privacy and room for surrounding sidelites or a transom. Panel depth, surface texture and hardware placement determine whether the result reads traditional or transitional.',
    projectGuidance: 'Measure the entrance and confirm slab width, swing, frame, sill and lock preparation before selecting the panel proportions. Finish direction and any surrounding glass should be coordinated with the complete elevation.',
    comparisonGuidance: 'Compare it with four- or six-panel doors for a busier traditional face, or with a flush slab when colour and hardware should carry the design.'
  },
  'WRP-D002': {
    selectionGuidance: 'A smooth flush face removes panel embossing, giving paint colour, pull hardware or a carefully placed glass cut-out the visual lead. Its flat surface is best suited to entrances seeking a restrained contemporary expression.',
    projectGuidance: 'Confirm slab dimensions, edge and lock preparation, swing, frame and approved glass machining after measurement. Finish colour and sun exposure deserve review because a broad unbroken face makes alignment and surface condition easy to see.',
    comparisonGuidance: 'Compare it with woodgrain when a stained appearance is desired, or with a one-panel door for subtle depth without a traditional multi-panel layout.'
  },
  'WRP-D003': {
    selectionGuidance: 'Oak-style embossing creates a familiar, more linear wood appearance while retaining fiberglass construction. The grain is most convincing when stain colour, panel geometry and nearby wood finishes are considered together.',
    projectGuidance: 'Review a physical grain-and-finish sample, then confirm slab size, swing, frame, sill and compatible glass preparation. Exposure and dark stain direction should be resolved before the finishing specification is approved.',
    comparisonGuidance: 'Compare it with mahogany grain for a deeper, more varied texture, and with smooth fiberglass when a painted rather than stained entrance is preferred.'
  },
  'WRP-D004': {
    selectionGuidance: 'Mahogany-style embossing provides a deeper, more pronounced wood character than a restrained oak grain. It suits warm stained entrances where the slab surface should remain a visible design feature.',
    projectGuidance: 'Compare finish samples at the entrance, then coordinate panel pattern, slab size, swing, frame and approved glass work. Solar exposure and darker stain colours can materially affect the finishing decision.',
    comparisonGuidance: 'Compare it directly with oak grain for texture and colour character, or with a smooth slab when contemporary paint and hardware should dominate.',
    considerationReplacements: { 'Panel embossment varies across mapped slabs': 'Panel embossment varies by the selected slab design' }
  },
  'WRP-D005': {
    selectionGuidance: 'Craftsman proportions concentrate visual weight in the lower panels and may pair with a restrained upper lite. The geometry works especially well on bungalow and transitional elevations where horizontal panel lines support the architecture.',
    projectGuidance: 'Confirm the exact panel and upper-lite proportions, hardware height, slab width, swing and frame after measurement. Smooth versus woodgrain surface and any sidelite should be chosen as part of the same composition.',
    comparisonGuidance: 'Compare it with a two-panel door for simpler symmetry or with narrow-lite glass when daylight should be vertical rather than concentrated above the panels.'
  },
  'WRP-D006': {
    selectionGuidance: 'Six repeated panels create the most recognizably traditional solid-door face in this group. The layout provides full privacy and visual detail without depending on decorative glass.',
    projectGuidance: 'Measure the opening and confirm how the six-panel moulding fits the slab width, lock position and frame. Surface texture, paint or stain direction, swing and sill details complete the entrance specification.',
    comparisonGuidance: 'Compare it with four panel for larger panel fields, or with two panel when a quieter traditional composition better suits the elevation.'
  },
  'WRP-D007': {
    selectionGuidance: 'Full-lite glass occupies most of the slab face, maximizing daylight and views while making privacy and solar exposure central decisions. The glass itself becomes the main visual feature of the entrance.',
    projectGuidance: 'Confirm visible glass dimensions, safety construction, privacy treatment, glazing performance, swing and frame after the entrance is measured. Hardware and finish should be coordinated around the large glass opening.',
    comparisonGuidance: 'Compare it with three-quarter glass when some lower slab area is useful, or with half glass when privacy and panel presence should carry more weight.'
  },
  'WRP-D008': {
    selectionGuidance: 'A half-lite arrangement keeps the upper portion bright while leaving a substantial solid lower section for privacy and panel detail. It offers a deliberate middle ground between a solid slab and a full-glass door.',
    projectGuidance: 'Measure the entrance and confirm lite dimensions, lower-panel geometry, privacy, safety glass, frame and swing. Sightlines from inside the home should be checked against the proposed glass height.',
    comparisonGuidance: 'Compare it with three-quarter glass for more daylight, or with narrow lite when a vertical view is preferable to a broad upper opening.'
  },
  'WRP-D009': {
    selectionGuidance: 'Three-quarter glass extends daylight farther down the slab than a half-lite while retaining a visible lower rail or panel area. The proportion often feels lighter than a panelled door without becoming a full wall of glass.',
    projectGuidance: 'Confirm the exact glass height, lower slab proportion, privacy, safety construction, swing and frame using the measured entrance. Handle placement and interior sightlines should be reviewed with the selected insert.',
    comparisonGuidance: 'Compare it with full glass for maximum view and with half glass when a stronger lower panel presence or higher privacy line is preferred.'
  },
  'WRP-D010': {
    selectionGuidance: 'A narrow vertical lite introduces daylight and a focused view while preserving more solid slab area than broad glass configurations. Its position can produce a distinctly contemporary asymmetry or a restrained traditional accent.',
    projectGuidance: 'Confirm lite width and location, eye-level privacy, lock clearance, slab construction, swing and frame after measurement. Hardware must fit comfortably beside the glass preparation.',
    comparisonGuidance: 'Compare it with half glass for a wider daylight opening, or with a solid Craftsman door when panel geometry should remain the main feature.'
  },
  'WRP-D011': {
    selectionGuidance: 'Four larger panel fields create a traditional door face with fewer divisions than a six-panel slab. The broader geometry can feel more substantial while maintaining full privacy and a familiar panelled appearance.',
    projectGuidance: 'Confirm panel proportions at the required slab width, along with swing, frame, lock preparation, sill and finish. Smooth or textured surfaces will change how strongly the moulding reads in daylight.',
    comparisonGuidance: 'Compare it with six panel for finer traditional rhythm and with two panel for a simpler, more vertically balanced face.'
  },
  'WRP-D012': {
    selectionGuidance: 'One large recessed panel gives the woodgrain surface room to read without the visual repetition of a multi-panel slab. The restrained geometry bridges contemporary and transitional entrances.',
    projectGuidance: 'Review grain and finish samples, then confirm panel depth, slab width, swing, frame, sill and hardware position. Any glass preparation must be approved for the selected slab rather than assumed from the panel shape.',
    comparisonGuidance: 'Compare it with flush woodgrain for an even quieter face, or with two panel when additional traditional definition is desirable.'
  },
  'WRP-G001': {
    selectionGuidance: 'Dark vertical accents give this glass a strong linear graphic while partially obscured areas soften direct views. It is a better fit when contemporary contrast matters and moderate privacy is acceptable.',
    projectGuidance: 'Confirm insert size, compatible slab, privacy from both sides and the relationship between dark accents, door colour and hardware. Night lighting can reveal more interior silhouette than the daytime view suggests.',
    comparisonGuidance: 'Compare it with non-camed linear privacy glass for a quieter effect, or with high-privacy geometric glass when obscurity matters more than dark detail.'
  },
  'WRP-G002': {
    selectionGuidance: 'Repeated geometric shapes and strongly obscured glass create a contemporary pattern with higher privacy than clear or lightly textured options. Pattern scale becomes more noticeable as the insert grows.',
    projectGuidance: 'Match the glass size to a compatible slab and review how the geometry aligns at eye level. When possible, view the pattern from inside and outside under changing natural light before final selection.',
    comparisonGuidance: 'Compare it with frosted high-privacy glass for a quieter surface, or with contemporary camed glass when visible metal lines are part of the design.'
  },
  'WRP-G003': {
    selectionGuidance: 'Broad frosted or obscured areas diffuse daylight without relying on ornate bevels or caming. The result is visually quiet and privacy-led, though silhouettes may still appear when the interior is brighter than outside.',
    projectGuidance: 'Confirm glass dimensions, compatible slab and sightlines from nearby walks or rooms. Review an available sample under day and evening lighting because the balance of glow and obscurity changes with conditions.',
    comparisonGuidance: 'Compare it with geometric high-privacy glass for more pattern, or with clear-zone glass when controlled outward views are important.'
  },
  'WRP-G004': {
    selectionGuidance: 'Deliberate clear bands interrupt sandblasted or frosted fields, creating crisp contrast and selective views. The location of each clear zone is as important as the overall privacy rating.',
    projectGuidance: 'Choose the insert size only after checking where the clear areas fall relative to eye level, approach paths and interior rooms. Coordinate the same geometry across sidelites only when the available sizes align.',
    comparisonGuidance: 'Compare it with fully frosted glass for greater obscurity, or with linear privacy glass for a more continuous patterned rhythm.'
  },
  'WRP-G005': {
    selectionGuidance: 'Restrained vertical or grid-like lines organize clear and obscured glass without decorative bevels. The pattern adds structure while remaining quieter than camed or highly ornamental designs.',
    projectGuidance: 'Confirm line spacing, clear-area placement, insert dimensions and compatible slab construction. View the proposed pattern against both exterior daylight and the interior background before settling on privacy.',
    comparisonGuidance: 'Compare it with black linear glass for stronger contrast, or with wide-reed texture when the glass should read as a continuous surface rather than a drawn pattern.'
  },
  'WRP-G006': {
    selectionGuidance: 'Wide vertical reeds bend and distort the view while carrying daylight through the entrance. The repeated texture produces architectural rhythm without metal caming or isolated decorative pieces.',
    projectGuidance: 'Confirm reed orientation, textured-face direction, glass dimensions and slab compatibility. Privacy should be viewed from realistic distances because broad reeds behave differently up close and across a foyer.',
    comparisonGuidance: 'Compare it with frosted glass for a more even glow, or with linear privacy glass when crisp drawn lines are preferred to optical texture.'
  },
  'WRP-G007': {
    selectionGuidance: 'Predominantly clear glass with subtle patterning preserves outward visibility and bright daylight. Texture supplies movement and detail, but this is not the right direction when strong privacy is required.',
    projectGuidance: 'Check the actual view-through area from inside and outside, then confirm insert size and slab compatibility. Background colours, landscaping and changing daylight can make the light pattern appear more or less prominent.',
    comparisonGuidance: 'Compare it with clear-zone glass for more deliberate privacy bands, or with classic beveled glass when sparkle and depth should become a focal feature.'
  },
  'WRP-G008': {
    selectionGuidance: 'Clear bevels and contrasting textured pieces create sparkle, depth and a recognizably traditional decorative composition. Clear facets can also open direct sightlines, so ornament and privacy need to be weighed together.',
    projectGuidance: 'Confirm pattern scale, insert size, sidelite availability and compatible slab. Review an available sample in natural light and note which beveled areas remain transparent from the approach to the door.',
    comparisonGuidance: 'Compare it with contemporary camed glass for cleaner geometry, or with hammered glass when irregular texture should soften the formal bevelled effect.'
  },
  'WRP-G009': {
    selectionGuidance: 'Hammered or irregular texture breaks up reflections and partially obscures the view, giving the entrance a handcrafted character. Bevels or clear accents may add sparkle without imposing a strict geometric grid.',
    projectGuidance: 'Confirm the balance of textured and clear pieces, glass dimensions, slab compatibility and sidelite options. View texture from both sides where a sample is available, since highlights and privacy shift with the light source.',
    comparisonGuidance: 'Compare it with classic beveled glass for a more formal composition, or with organic decorative glass for softer flowing movement.',
    considerationReplacements: { 'Each mapped pattern remains a distinct quoted choice': 'Each available pattern remains a distinct visual choice' }
  },
  'WRP-G010': {
    selectionGuidance: 'Crisp camed lines organize bevelled and textured pieces into a contemporary composition. The visible metal network gives the glass more graphic structure than simple privacy textures while remaining less ornate than traditional bevel patterns.',
    projectGuidance: 'Coordinate caming finish with door hardware, then confirm insert size, privacy, sidelite format and slab compatibility. Clear pieces should be checked at eye level under both exterior and interior lighting.',
    comparisonGuidance: 'Compare it with classic beveled glass for a more traditional focal point, or with geometric privacy glass when high obscurity matters more than visible caming.'
  },
  'WRP-G011': {
    selectionGuidance: 'This narrow full-height format is designed for sidelites rather than the door slab itself. Its slim proportions can stretch or simplify a decorative pattern, making alignment with the door and any opposite sidelite essential.',
    projectGuidance: 'Measure the sidelite frame, confirm single or paired layout, eye-level privacy and alignment with door panels or door glass. Select the pattern only from sizes actually compatible with the complete entrance frame.',
    comparisonGuidance: 'Compare matching sidelites with a solid door for framed daylight, or coordinate them with door glass only when pattern heights and privacy levels work together.'
  },
  'WRP-G012': {
    selectionGuidance: 'Flowing lines and softly layered textured pieces create movement without a rigid grid. The design can bridge traditional and contemporary doors, with clear accents determining how much direct view remains.',
    projectGuidance: 'Confirm pattern direction, insert proportions, sidelite availability and slab compatibility. When a sample is available, view it against changing backgrounds because the softer shapes respond strongly to natural light.',
    comparisonGuidance: 'Compare it with hammered glass for more irregular surface texture, or with contemporary camed glass when sharper linework better suits the entrance.'
  },
  'WRP-P001': {
    selectionGuidance: 'Three- and four-panel layouts can span wider openings and change both panel movement and clear passage. The number of panels alone does not reveal which sections operate or how much usable opening remains.',
    projectGuidance: 'Measure the full opening, identify desired traffic flow and map fixed versus moving panels before selecting frame, glazing, screens and hardware. Sill support and drainage must suit the wider assembled unit.',
    comparisonGuidance: 'Compare a proposed multi-panel layout with a simpler two-panel door using actual clear-opening dimensions, not overall frame width.'
  },
  'WRP-P002': {
    selectionGuidance: 'A two-panel slider is the simplest patio-door arrangement, typically pairing one primary moving panel with a companion panel. It suits common residential openings where straightforward access matters more than a broad multi-panel span.',
    projectGuidance: 'Confirm handing, actual clear passage, furniture clearance, screen direction and threshold conditions after measurement. Frame depth, glazing and lock hardware are then selected for the opening and exposure.',
    comparisonGuidance: 'Compare it with multi-panel layouts only when the wall opening can support the added width and the resulting panel movement improves circulation.'
  },
  'WRP-P003': {
    selectionGuidance: 'An insulated PVC frame provides a familiar residential patio-door direction with profiles designed around thermal chambers, reinforcement and weather sealing. Sightlines are generally fuller than the slimmest aluminum options.',
    projectGuidance: 'Measure opening width, wall depth and sill support, then confirm reinforcement, panel layout, glazing, screen and hardware for the selected size. Dark finishes and larger panels need configuration-specific review.',
    comparisonGuidance: 'Compare it with slim aluminum when glass area and narrow profiles lead the decision, or with hybrid construction when exterior durability and interior thermal goals differ.'
  },
  'WRP-P004': {
    selectionGuidance: 'Aluminum construction offers a crisp, rigid frame appearance that can support contemporary elevations and larger panel directions. Thermal-break design and visible profile width vary, so aluminum alone does not define performance.',
    projectGuidance: 'Confirm opening size, panel limits, sill, drainage, glazing, thermal design and hardware after measurement. Large panels also require a practical handling route and adequate structural support.',
    comparisonGuidance: 'Compare it with PVC for frame warmth and profile character, and with slim-frame aluminum when reduced sightlines are the primary architectural goal.'
  },
  'WRP-P005': {
    selectionGuidance: 'Hybrid construction combines materials so the interior, exterior or structural parts can answer different durability, thermal and finish needs. The benefit depends on the actual material arrangement rather than the hybrid label itself.',
    projectGuidance: 'Measure the opening and review cladding transitions, reinforcement, panel movement, sill, glazing and finish compatibility as one assembly. Confirm how interior and exterior materials meet at corners and thresholds.',
    comparisonGuidance: 'Compare the actual material stack with PVC and aluminum alternatives, focusing on sightlines, maintenance, finish and documented performance.'
  },
  'WRP-P006': {
    selectionGuidance: 'Reduced aluminum sightlines place more visual emphasis on glass and suit larger contemporary openings. The narrower profile increases the importance of structural limits, thermal-break design, panel weight and installation tolerance.',
    projectGuidance: 'Measure the opening and access route, then verify maximum panel size, sill support, drainage, glazing, screen and lock package. The frame must be installed plumb and level for large sliding panels to operate correctly.',
    comparisonGuidance: 'Compare it with standard aluminum for profile and panel limits, and with PVC when thermal direction matters more than the narrowest possible frame.'
  }
};