// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "BotNotch",
  platforms: [.macOS(.v14)],
  products: [
    .executable(name: "bot-notch", targets: ["BotNotch"]),
  ],
  targets: [
    .executableTarget(
      name: "BotNotch",
      path: "Sources",
      resources: [.copy("Resources/Idle")]
    ),
  ]
)
