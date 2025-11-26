
    export type SFSymbolNames = "square.and.arrow.up" | "square.and.arrow.down" | "rectangle.portrait.and.arrow.right" | "pencil" | "pencil.slash" | "square.and.pencil" | "rectangle.and.pencil.and.ellipsis" | "scribble" | "trash" | "folder" | "paperplane" | "tray" | "document" | "arrow.up.document" | "arrow.down.document" | "document.on.document" | "calendar" | "arrowshape.left" | "arrowshape.forward" | "arrowshape.up" | "arrowshape.down" | "arrowshape.turn.up.left" | "arrowshape.turn.up.right" | "arrowshape.turn.up.left.2" | "paperclip" | "link" | "personalhotspot.slash" | "person" | "person.fill.checkmark" | "person.badge.plus" | "person.badge.key" | "person.2" | "person.2.badge.plus" | "person.line.dotted.person" | "person.crop.circle" | "slowmo" | "rectangle.on.rectangle.badge.gearshape" | "globe" | "sun.max" | "sun.max.fill" | "moon.fill" | "sparkles" | "play" | "play.circle" | "play.square" | "play.rectangle" | "pause" | "stop" | "repeat" | "arrow.trianglehead.clockwise" | "arrow.trianglehead.2.counterclockwise" | "circle.lefthalf.filled" | "circle.on.square" | "circle.dotted" | "circle.grid.2x2" | "square.dashed" | "square.on.square" | "exclamationmark.triangle" | "info.triangle" | "heart" | "star" | "flag" | "location" | "bell" | "tag" | "bolt" | "camera" | "message" | "checkmark.message" | "bubble" | "bubble.left.and.bubble.right" | "phone" | "phone.fill" | "gear" | "gearshape" | "gearshape.2" | "signature" | "ellipsis" | "ellipsis.circle" | "bag" | "cart" | "creditcard" | "paintbrush" | "paintbrush.pointed" | "lightbulb" | "party.popper" | "lock" | "lock.rectangle" | "lock.shield" | "lock.open" | "key" | "mappin.and.ellipse" | "map" | "selection.pin.in.out" | "desktopcomputer" | "macbook.and.ipod" | "iphone" | "car.rear" | "tachometer" | "face.smiling" | "xmark.triangle.circle.square" | "hand.raised" | "hand.thumbsup" | "hand.thumbsdown" | "hand.point.up.left" | "hand.draw" | "hand.tap" | "hand.point.up" | "hands.clap" | "photo" | "slider.vertical.3" | "cube" | "square.stack.3d.down.right" | "square.stack.3d.up" | "clock" | "chart.bar" | "chart.pie" | "waveform.path.ecg" | "line.3.horizontal.decrease.circle" | "character.circle" | "textformat.size.larger" | "textformat.characters.dottedunderline" | "bold" | "italic" | "underline" | "strikethrough" | "at" | "plus" | "plus.square" | "minus" | "minus.square" | "multiply" | "checkmark" | "chevron.left" | "chevron.right" | "chevron.up" | "chevron.down" | "chevron.up.2" | "chevron.down.2" | "chevron.up.forward.2" | "chevron.compact.up" | "chevron.compact.down" | "chevron.compact.left" | "chevron.compact.right" | "arrow.left" | "arrow.right" | "arrow.up" | "arrow.down" | "arrow.up.left" | "arrow.up.right" | "arrow.down.left" | "arrow.down.right" | "arrow.counterclockwise"

    export type CharEntry = {
        path: string,
        geometry: { width: number, height: number }
      }
      
      export type SymbolEntry = {
        black: CharEntry,
        bold: CharEntry,
        heavy: CharEntry,
        light: CharEntry,
        medium: CharEntry,
        regular: CharEntry,
        semibold: CharEntry,
        thin: CharEntry,
        ultralight: CharEntry,
      }

      export type SymbolSet = {
        version: string,
        precision: number,
        fontSize: number,
        symbols: { [key in SFSymbolNames]: SymbolEntry }
      }
